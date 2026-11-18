"""Shared entry dates: Philippine display/input, UTC milliseconds at the API boundary."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import streamlit as st

ZONE = ZoneInfo("Asia/Manila")


def date_text(value):
    return datetime.fromtimestamp(value / 1000, ZONE).strftime("%d %b %Y, %I:%M %p") + " PHT"


def timing_caption(item):
    parts = []
    if item.get("publication_state") == "scheduled":
        parts.append("Publishes " + date_text(item["publish_at"]))
    if item.get("due_at"):
        state = {"overdue": " · Overdue", "late": " · Completed late", "completed": " · Completed on time"}
        parts.append("Due " + date_text(item["due_at"]) + state.get(item.get("due_state"), ""))
    if parts:
        st.caption(" | ".join(parts))


# Scheduling — Keep the displayed edit version until Save or explicit reload.
# Dates change delivery/compliance only; content revisions and grades remain intact.
def schedule_controls(api, current):
    previous = st.session_state.get("schedule_editor")
    if not previous or previous["id"] != current["id"]:
        st.session_state["schedule_editor"] = current
    item = st.session_state["schedule_editor"]
    suffix = f"{item['id']}_{item['edit_version']}"
    with st.expander("Publishing and due date"):
        st.caption("Asia/Manila (PHT). Late work is accepted and marked late; no automatic grade penalty.")
        if item["edit_version"] != current["edit_version"]:
            st.warning("Entry changed elsewhere. Reload before saving its schedule.")
        if st.button("Reload schedule"):
            st.session_state["schedule_editor"] = current
            st.rerun()
        with st.form("schedule_" + suffix):
            modes = ["Draft", "Publish now", "Scheduled"]
            initial = {"draft": 0, "published": 1, "scheduled": 2}.get(item.get("publication_state"), 0)
            mode = st.selectbox("Publication", modes, index=initial)
            release = datetime.fromtimestamp(item["publish_at"] / 1000, ZONE) if item.get("publish_at") else datetime.now(ZONE) + timedelta(days=1)
            pub_date = st.date_input("Publish date", release.date())
            pub_time = st.time_input("Publish time", release.time().replace(second=0, microsecond=0), step=60)
            has_due = st.checkbox("Set completion due date", value=bool(item.get("due_at")))
            due = datetime.fromtimestamp(item["due_at"] / 1000, ZONE) if item.get("due_at") else release + timedelta(days=7)
            due_date = st.date_input("Due date", due.date())
            due_time = st.time_input("Due time", due.time().replace(second=0, microsecond=0), step=60)
            save = st.form_submit_button("Save schedule")
        if save:
            timestamp = lambda date, time: int(datetime.combine(date, time, ZONE).timestamp() * 1000)
            api.post(f"/v1/items/{item['id']}/schedule", {
                "expected_edit_version": item["edit_version"], "published": mode != "Draft",
                "publish_at": timestamp(pub_date, pub_time) if mode == "Scheduled" else None,
                "due_at": timestamp(due_date, due_time) if has_due else None})
            for key in ("schedule_editor", "material_editor"):
                st.session_state.pop(key, None)
            st.session_state["notice"] = "Publishing schedule and due date saved."
            st.rerun()
