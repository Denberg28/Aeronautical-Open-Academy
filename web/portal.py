"""Role-aware presentation; the existing API remains the authorization boundary."""

import os
import re
from hashlib import sha256
from uuid import uuid4

import streamlit as st

from web.api import AcademyAPI, ApiError, api_origin


# UI — Shared typography and spacing; values use CSS rem units.
# Keep subject context above the 480 px scrolling material list on small screens.
STYLE = """
<style>
.block-container {max-width: 1080px; padding-top: 2rem; padding-bottom: 2rem;}
[data-testid="stMarkdownContainer"] p {line-height: 1.65; margin-bottom: 0.9rem;}
[data-testid="stText"] {white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65;}
[data-testid="stProgressBar"] [role="progressbar"] > div {background-color: #c29a36;}
</style>
"""


def setting(name, default=""):
    if name in os.environ:
        return os.environ[name]
    try:
        return st.secrets.get(name, default)
    except FileNotFoundError:
        return default


def reset_session(message):
    st.session_state.clear()
    st.session_state["notice"] = message
    st.rerun()


def saved(message):
    st.session_state["notice"] = message
    st.rerun()


# Accounts — Password inputs and per-account drafts never enter global caches.
def sign_in(api):
    st.subheader("Sign in")
    st.caption("Use your Academy account. Ask your administrator if you need access.")
    with st.form("sign_in"):
        email = st.text_input("Email", key="login_email", max_chars=254)
        password = st.text_input("Password", type="password", key="login_password", max_chars=128)
        submitted = st.form_submit_button("Sign in", type="primary")
    if submitted:
        result = api.post("/v1/auth/login", {"email": email, "password": password})
        st.session_state.clear()
        st.session_state["token"] = result["token"]
        st.rerun()


def change_password(api):
    with st.form("change_password"):
        old = st.text_input("Current password", type="password", max_chars=128)
        new = st.text_input("New password", type="password", max_chars=128)
        repeat = st.text_input("Repeat new password", type="password", max_chars=128)
        submit = st.form_submit_button("Change password")
    if submit:
        if new != repeat:
            st.error("The new passwords do not match.")
        else:
            api.post("/v1/auth/password", {"current_password": old, "new_password": new})
            reset_session("Password changed. Sign in again.")


def administration(api):
    with st.expander("Create account"):
        generation = st.session_state.get("account_form", 0)
        with st.form(f"create_account_{generation}"):
            name = st.text_input("Full name", max_chars=100)
            email = st.text_input("Account email", max_chars=254)
            role = st.selectbox("Role", ["student", "instructor", "admin"])
            number = st.text_input("Student ID (students only)", max_chars=32)
            password = st.text_input("Temporary password", type="password", max_chars=128,
                                     help="15–128 characters. The account must change it on first sign-in.")
            submit = st.form_submit_button("Create account")
        if submit:
            body = {"name": name, "email": email, "role": role, "password": password}
            if number:
                body["student_number"] = number
            api.post("/v1/admin/accounts", body)
            st.session_state["account_form"] = generation + 1
            saved("Account created. Share the temporary password privately.")


def subject_controls(api, subject):
    with st.expander("Subject settings"):
        snapshot = sha256((subject["title"] + "\0" + subject["description"]).encode()).hexdigest()[:16]
        with st.form(f"subject_text_{subject['id']}_{snapshot}"):
            title = st.text_input("Subject title", subject["title"], max_chars=160)
            description = st.text_area("Description", subject["description"], max_chars=1000)
            submit = st.form_submit_button("Save subject")
        if submit:
            api.post("/v1/subjects/" + subject["id"], {
                "title": title, "description": description,
                "expected_title": subject["title"], "expected_description": subject["description"]})
            saved("Subject saved.")
        policy = api.get(f"/v1/subjects/{subject['id']}/eligibility")
        with st.form(f"eligibility_{subject['id']}_{policy['revision']}"):
            all_students = st.checkbox("Allow all registered students", value=policy["all_students"])
            numbers = st.text_area("Eligible student IDs", "\n".join(policy["student_numbers"]),
                                   help="One ID per line. Leave empty and uncheck All to close enrollment.")
            submit = st.form_submit_button("Save enrollment access")
        if submit:
            ids = [s.strip() for s in numbers.splitlines() if s.strip()]
            if all_students and ids:
                st.error("Clear the ID list when allowing all registered students.")
            else:
                api.post(f"/v1/subjects/{subject['id']}/eligibility", {
                    "all_students": all_students, "student_numbers": ids,
                    "expected_revision": policy["revision"]})
                saved("Enrollment access saved.")


# Authoring — Create a recoverable draft first, upload next, then explicitly publish.
# An interrupted upload leaves the draft visible and retryable; no automatic write retries.
def add_material(api, subject, uploads):
    with st.expander("Add material"):
        generation = st.session_state.get("material_form", 0)
        with st.form(f"add_material_{subject['id']}_{generation}"):
            title = st.text_input("Material title", max_chars=160)
            body = st.text_area("Reading text or instructions", max_chars=12000,
                                help="Paste Google Docs, Slides, Drive, YouTube or website links here.")
            modes = ["Text and links", "PDF upload"] if uploads else ["Text and links"]
            mode = st.selectbox("Material format", modes)
            submit = st.form_submit_button("Create draft", type="primary")
        if submit:
            result = api.post(f"/v1/subjects/{subject['id']}/items", {
                "kind": "material", "title": title, "body": body,
                "material_mode": "file" if mode == "PDF upload" else "text", "published": False})
            st.session_state["item"] = result["id"]
            st.session_state["material_form"] = generation + 1
            saved("Draft created. Upload a PDF or publish when ready.")
        if not uploads:
            st.caption("PDF uploads are not enabled for this Academy server. Text and hosted links are available.")


def edit_material(api, item):
    suffix = f"{item['id']}_{item['edit_version']}"
    with st.expander("Edit material"):
        with st.form("edit_" + suffix):
            title = st.text_input("Title", item["title"], max_chars=160)
            body = st.text_area("Text or instructions", item["body"], max_chars=12000)
            ready = item["material_mode"] == "text" or item["has_file"]
            published = st.checkbox("Published", value=item["published"], disabled=not ready)
            submit = st.form_submit_button("Save material")
        if submit:
            api.post("/v1/items/" + item["id"], {
                "title": title, "body": body, "published": published,
                "expected_edit_version": item["edit_version"]})
            saved("Material saved.")
        if item["material_mode"] == "file":
            with st.form("upload_" + suffix):
                pdf = st.file_uploader("PDF file · up to 50 MiB", type=["pdf"])
                upload = st.form_submit_button("Replace PDF" if item["has_file"] else "Upload PDF")
            if upload:
                if pdf is None:
                    st.error("Choose a PDF first.")
                else:
                    api.post(f"/v1/items/{item['id']}/file", data=pdf.getvalue(),
                             version=item["edit_version"])
                    saved("PDF uploaded. Review it, then publish when ready.")
        with st.form("archive_" + suffix):
            confirm = st.checkbox("Archive this material")
            archive = st.form_submit_button("Archive")
        if archive and confirm:
            api.post("/v1/items/" + item["id"], {
                "archived": True, "expected_edit_version": item["edit_version"]})
            st.session_state.pop("item", None)
            saved("Material archived.")


def reading_text(api, item):
    # Plain text prevents user-authored HTML, images or Markdown from bypassing link checks.
    st.text(item["body"])
    links = list(dict.fromkeys(re.findall(r"https?://[^\s<>\"']+", item["body"])))
    for index, candidate in enumerate(links):
        candidate = candidate.rstrip(".,;!?)\u3002")
        if st.button("Open reference " + str(index + 1), key=f"link_{item['id']}_{index}"):
            result = api.post(f"/v1/items/{item['id']}/open-link", {
                "url": candidate, "expected_revision": item["revision"]})
            st.link_button("Continue to " + result["host"], result["url"])


def assessment(api, item, student):
    if not student:
        st.caption("Assessment authoring and grading remain available in the Academy app.")
        return
    result = item.get("form_result") or item.get("attempt") or item.get("submission")
    if result:
        if result.get("score") is not None:
            maximum = 1 if item.get("attempt") else 100
            st.success(f"Result: {result['score']:g}/{maximum}")
            if result.get("feedback"):
                st.text(result["feedback"])
        else:
            st.info("Submitted · awaiting assessment")
        return
    identity = f"{item['id']}_{item['revision']}"
    # The key survives uncertain transport outcomes. The API rejects duplicate/changed work.
    request_key = st.session_state.setdefault("submit_" + identity, str(uuid4()))
    with st.form("assessment_" + identity):
        answers = []
        if item.get("questions"):
            for index, question in enumerate(item["questions"]):
                st.text(f"{index + 1}. {question['prompt']}")
                answer = st.radio("Choose an answer", range(len(question["options"])), index=None,
                                  format_func=lambda n, q=question: q["options"][n], key=f"answer_{identity}_{index}")
                answers.append(answer)
        elif item["kind"] == "quiz":
            answers = [st.radio("Choose an answer", range(len(item["options"])), index=None,
                                format_func=lambda n: item["options"][n])]
        else:
            output = st.text_area("Your response", max_chars=12000, height=220)
        submit = st.form_submit_button("Submit", type="primary")
    if submit:
        if answers and any(answer is None for answer in answers):
            st.error("Answer every question before submitting.")
            return
        if item.get("questions"):
            route, body = "answers", {"answers": answers, "expected_revision": item["revision"]}
        elif item["kind"] == "quiz":
            route, body = "quiz", {"choice": answers[0]}
        else:
            route, body = "submission", {"output": output}
        api.post(f"/v1/items/{item['id']}/{route}", body, key=request_key)
        saved("Response submitted.")


def workspace(api, me):
    account = me["account"]
    student = account["role"] == "student"
    with st.sidebar:
        st.text(account["name"])
        st.caption(account["role"].title())
        if st.button("Sign out"):
            try:
                api.post("/v1/auth/logout")
            finally:
                reset_session("Signed out.")
        if not account["must_change_password"]:
            with st.expander("Change password"):
                change_password(api)
    if account["must_change_password"]:
        st.info("Change your temporary password to continue.")
        change_password(api)
        return
    if account["role"] == "admin":
        administration(api)
    if not student:
        with st.expander("Create subject"):
            generation = st.session_state.get("subject_form", 0)
            with st.form(f"create_subject_{generation}"):
                title = st.text_input("Subject title", max_chars=160)
                description = st.text_area("Subject description", max_chars=1000)
                submit = st.form_submit_button("Create subject")
            if submit:
                api.post("/v1/subjects", {"title": title, "description": description})
                st.session_state["subject_form"] = generation + 1
                saved("Subject created.")
    else:
        with st.expander("Enroll in a subject"):
            page = st.number_input("Enrollment page", min_value=1, value=1, step=1)
            discover = api.get(f"/v1/subjects/discover?offset={(page - 1) * 100}")["subjects"]
            if not discover:
                st.caption("No available subjects on this page. Ask your instructor to check eligibility.")
            for subject in discover:
                if st.button("Join · " + subject["title"], key="join_" + subject["id"]):
                    api.post(f"/v1/subjects/{subject['id']}/enrol")
                    saved("Enrolled.")
    subjects = api.get("/v1/subjects")["subjects"]
    if not subjects:
        st.info("Your subjects will appear here.")
        return
    by_id = {subject["id"]: subject for subject in subjects}
    subject_id = st.selectbox("Subject", list(by_id), format_func=lambda sid: by_id[sid]["title"])
    detail = api.get("/v1/subjects/" + subject_id)
    subject, items = detail["subject"], detail["items"]
    st.subheader(subject["title"])
    if student:
        summary = detail["summary"]
        st.progress(summary["completion_percent"] / 100,
                    text=f"{summary['completed']} of {summary['total']} complete")
    with st.expander("About this subject"):
        st.text(subject["description"])
    if not student:
        subject_controls(api, subject)
        add_material(api, subject, me["capabilities"].get("material_upload", False))
    search = st.text_input("Find material", placeholder="Search titles")
    visible = [item for item in items if search.casefold() in item["title"].casefold()]
    with st.container(height=480, border=False):
        selected = st.session_state.get("item")
        if selected not in {item["id"] for item in items}:
            st.session_state.pop("item", None)
            selected = None
        if not selected:
            if not visible:
                st.info("No materials found.")
            for item in visible:
                label = "Read" if item["kind"] == "material" else "Take " + (
                    "examination" if item.get("assessment_type") == "examination" else item["kind"])
                state = " · Done" if item["completed"] else ""
                if not student and not item["published"]:
                    state += " · Draft"
                if st.button(f"{label} · {item['title']}{state}", key="open_" + item["id"], width="stretch"):
                    st.session_state["item"] = item["id"]
                    st.rerun()
        else:
            if st.button("Back to materials"):
                st.session_state.pop("item", None)
                st.rerun()
            # Fetch again immediately before rendering content, including current permissions.
            item = api.get("/v1/items/" + selected)["item"]
            st.divider()
            st.subheader(item["title"])
            reading_text(api, item)
            if item["kind"] == "material":
                if item["material_mode"] == "file":
                    if item["has_file"]:
                        st.pdf(api.content(item["id"]), height=400,
                               key=f"pdf_{item['id']}_{item['revision']}", alt=item["title"])
                    else:
                        st.info("PDF upload pending.")
                if student and (item["material_mode"] == "text" or item["has_file"]):
                    if st.button("Mark unread" if item["completed"] else "Mark as read", key="complete_" + selected):
                        api.post(f"/v1/items/{selected}/complete", {"completed": not item["completed"]})
                        saved("Reading progress saved.")
                if not student and (account["role"] == "admin" or item["owner_id"] == account["id"]):
                    edit_material(api, item)
            else:
                assessment(api, item, student)


def main():
    st.set_page_config(page_title="Aeronautical Open Academy", page_icon="✈", layout="wide")
    st.markdown(STYLE, unsafe_allow_html=True)
    st.title("Aeronautical Open Academy")
    st.caption("Learn. Practice. Progress.")
    if notice := st.session_state.pop("notice", None):
        st.success(notice)
    configured = setting("ACADEMY_API_URL")
    if not configured:
        st.info("The web portal is ready for connection to your Academy server.")
        st.caption("Administrator: configure ACADEMY_API_URL in Streamlit Secrets. See docs/STREAMLIT.md.")
        return
    try:
        origin = api_origin(configured, allow_local=setting("ACADEMY_ALLOW_LOCAL_API") == "1")
    except ValueError as error:
        st.error(str(error))
        return
    api = AcademyAPI(origin, st.session_state.get("token"))
    try:
        if not api.token:
            sign_in(api)
        else:
            # Deliberately uncached: role changes, revocation and expiry apply on every rerun.
            workspace(api, api.get("/v1/me"))
    except ApiError as error:
        if error.status == 401 and api.token:
            reset_session("Your session ended. Sign in again.")
        st.error(str(error))
        if error.status == 409:
            st.caption("Refresh the current content and review it before retrying.")
        st.button("Refresh", on_click=lambda: None)


if __name__ == "__main__":
    main()
