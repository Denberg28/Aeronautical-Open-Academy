"""Real API/SQLite + Streamlit AppTest integration; no cloud or Drive claims."""

import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

import requests
from streamlit.testing.v1 import AppTest

from web.api import AcademyAPI, ApiError, MAX_PDF_BYTES, api_origin, validate_pdf

ROOT = Path(__file__).resolve().parents[2]
PASSWORD = "Private portal fixture password!"
PDF = (ROOT / "app/src/main/assets/materials/a-learning-guide.pdf").read_bytes()


class TransportTests(unittest.TestCase):
    def test_origin_boundary(self):
        self.assertEqual(api_origin("https://academy.example.org/"), "https://academy.example.org")
        for value in ["http://example.org", "https://a:b@example.org", "https://example.org/v1", "https://example.org?x=1", "//example.org"]:
            with self.assertRaises(ValueError):
                api_origin(value)
        with self.assertRaises(ValueError):
            api_origin("http://localhost:8787")
        self.assertEqual(api_origin("http://127.0.0.1:8787", True), "http://127.0.0.1:8787")

    def test_pdf_validation(self):
        self.assertEqual(validate_pdf(PDF), PDF)
        for value in [b"", b"<html>not PDF</html>", b"%PDF-truncated", b"x" * (MAX_PDF_BYTES + 1)]:
            with self.assertRaises(ApiError):
                validate_pdf(value)

    def test_no_redirects_and_network_error_hides_secrets(self):
        with patch("web.api.requests.request", side_effect=requests.ConnectionError("secret diagnostic")) as call:
            with self.assertRaises(ApiError) as raised:
                AcademyAPI("https://academy.example.org", "private-token").get("/v1/me")
            self.assertNotIn("secret", str(raised.exception))
            self.assertFalse(call.call_args.kwargs["allow_redirects"])
            self.assertEqual(call.call_args.kwargs["timeout"], (5, 30))

    def test_redirect_response_and_corrupted_material_are_rejected(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status_code = 302
        response.ok = True
        response.iter_content.return_value = iter([b"redirect"])
        with patch("web.api.requests.request", return_value=response):
            with self.assertRaises(ApiError) as raised:
                AcademyAPI("https://academy.example.org", "secret-token").get("/v1/me")
            self.assertEqual(raised.exception.status, 502)
        response.status_code = 200
        response.headers = {"Content-Type": "application/pdf", "X-Content-SHA256": "bad"}
        response.iter_content.return_value = iter([PDF])
        with patch("web.api.requests.request", return_value=response):
            with self.assertRaises(ApiError):
                AcademyAPI("https://academy.example.org").content("test")


class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.child = subprocess.Popen(["node", "web/tests/fixture.mjs", cls.directory.name], cwd=ROOT,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        # Fixture prints only its bound port, no account/session data.
        port = cls.child.stdout.readline().strip()
        if not port.isdigit():
            raise RuntimeError("Fixture failed to start")
        cls.origin = "http://127.0.0.1:" + port
        cls.env = patch.dict(os.environ, {"ACADEMY_API_URL": cls.origin, "ACADEMY_ALLOW_LOCAL_API": "1"})
        cls.env.start()
        cls.admin = cls.login("admin@example.test", PASSWORD)

    @classmethod
    def tearDownClass(cls):
        cls.child.terminate()
        cls.child.communicate(timeout=15)
        cls.env.stop()
        cls.directory.cleanup()

    @classmethod
    def login(cls, email, password):
        token = AcademyAPI(cls.origin).post("/v1/auth/login", {"email": email, "password": password})["token"]
        return AcademyAPI(cls.origin, token)

    def account(self, role):
        email = uuid4().hex + "@example.test"
        created = self.admin.post("/v1/admin/accounts", {"email": email, "name": "Portal test " + role,
                                  "role": role, "password": PASSWORD})["account"]
        api = self.login(email, PASSWORD)
        api.post("/v1/auth/password", {"current_password": PASSWORD, "new_password": PASSWORD + "changed"})
        return created, self.login(email, PASSWORD + "changed")

    def app(self, api=None):
        app = AppTest.from_file(str(ROOT / "streamlit_app.py"), default_timeout=20)
        if api:
            app.session_state["token"] = api.token
        app.run()
        self.assertFalse(app.exception, str(app.exception))
        return app

    def button(self, app, label):
        return next(button for button in app.button if button.label == label)

    def test_configuration_and_login_logout(self):
        with patch.dict(os.environ, {"ACADEMY_API_URL": ""}):
            app = self.app()
            self.assertIn("ready for connection", app.info[0].value)
        app = self.app()
        app.text_input(key="login_email").set_value("admin@example.test")
        app.text_input(key="login_password").set_value(PASSWORD)
        self.button(app, "Sign in").click().run()
        self.assertFalse(app.exception, str(app.exception))
        self.assertTrue(app.session_state["token"])
        with self.assertRaises(KeyError):
            app.session_state["login_password"]
        self.button(app, "Sign out").click().run()
        with self.assertRaises(KeyError):
            app.session_state["token"]
        self.assertTrue(any(b.label == "Sign in" for b in app.button))

    def test_web_material_create_publish_read_and_revoke(self):
        author, api = self.account("instructor")
        learner, student = self.account("student")
        subject = api.post("/v1/subjects", {"title": "Portal workflow", "description": "Sample subject"})["id"]
        self.admin.post("/v1/admin/enrolments", {"subject_id": subject, "student_id": learner["id"]})
        app = self.app(api)
        next(w for w in app.text_input if w.label == "Material title").set_value("Reading one")
        next(w for w in app.text_area if w.label == "Reading text or instructions").set_value("First paragraph.\n\nSecond paragraph.")
        self.button(app, "Create draft").click().run()
        self.assertFalse(app.exception, str(app.exception))
        item = api.get("/v1/subjects/" + subject)["items"][0]
        self.assertFalse(item["published"])
        self.assertEqual(student.get("/v1/subjects/" + subject)["items"], [])
        next(w for w in app.checkbox if w.label == "Published").check()
        self.button(app, "Save material").click().run()
        self.assertFalse(app.exception, str(app.exception))
        view = self.app(student)
        self.button(view, "Read · Reading one").click().run()
        self.assertFalse(view.exception, str(view.exception))
        self.assertTrue(any("Second paragraph" in x.value for x in view.text))
        self.assertFalse(any(b.label == "Save material" for b in view.button))
        self.button(view, "Mark as read").click().run()
        self.assertEqual(student.get("/v1/subjects/" + subject)["summary"]["completion_percent"], 100)
        self.admin.post("/v1/admin/accounts/" + learner["id"], {"status": "suspended"})
        view.run()
        with self.assertRaises(KeyError):
            view.session_state["token"]
        self.assertFalse(any("Second paragraph" in x.value for x in view.text))

    def test_pdf_round_trip_drafts_conflicts_and_denials(self):
        _, author = self.account("instructor")
        learner, student = self.account("student")
        _, outsider = self.account("student")
        sid = author.post("/v1/subjects", {"title": "PDF workflow", "description": "Private PDF"})["id"]
        iid = author.post(f"/v1/subjects/{sid}/items", {"kind": "material", "title": "PDF reading",
                          "body": "Read the guide.", "material_mode": "file"})["id"]
        item = author.get("/v1/items/" + iid)["item"]
        author.post(f"/v1/items/{iid}/file", data=PDF, version=item["edit_version"])
        self.assertEqual(hashlib.sha256(author.content(iid)).digest(), hashlib.sha256(PDF).digest())
        with self.assertRaises(ApiError) as conflict:
            author.post(f"/v1/items/{iid}/file", data=PDF, version=item["edit_version"])
        self.assertEqual(conflict.exception.status, 409)
        self.admin.post("/v1/admin/enrolments", {"subject_id": sid, "student_id": learner["id"]})
        with self.assertRaises(ApiError):
            student.content(iid)
        item = author.get("/v1/items/" + iid)["item"]
        author.post("/v1/items/" + iid, {"published": True, "expected_edit_version": item["edit_version"]})
        self.assertEqual(student.content(iid), PDF)
        with self.assertRaises(ApiError):
            outsider.content(iid)
        with self.assertRaises(ApiError):
            student.post(f"/v1/items/{iid}/file", data=PDF)
        app = self.app(student)
        self.button(app, "Read · PDF reading").click().run()
        self.assertFalse(app.exception, str(app.exception))
        viewer = app.get("bidi_component")
        self.assertEqual(len(viewer), 1)
        self.assertEqual(viewer[0].proto.component_name, "streamlit-pdf.pdf_viewer")

    def test_inline_choice_form_grades_on_api(self):
        _, author = self.account("instructor")
        learner, student = self.account("student")
        sid = author.post("/v1/subjects", {"title": "Choice workflow", "description": "Quiz"})["id"]
        self.admin.post("/v1/admin/enrolments", {"subject_id": sid, "student_id": learner["id"]})
        author.post(f"/v1/subjects/{sid}/items", {"kind": "quiz", "title": "Quiz one", "body": "Choose one.",
                    "published": True, "questions": [{"prompt": "Two plus two?", "options": ["Four", "Five"], "correct_index": 0}]})
        app = self.app(student)
        self.button(app, "Take quiz · Quiz one").click().run()
        self.button(app, "Submit").click().run()
        self.assertTrue(any("Answer every question" in e.value for e in app.error))
        app.radio[0].set_value(0)
        self.button(app, "Submit").click().run()
        self.assertFalse(app.exception, str(app.exception))
        self.assertTrue(any("100/100" in s.value for s in app.success))


if __name__ == "__main__":
    unittest.main()
