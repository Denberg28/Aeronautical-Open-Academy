"""Bounded, uncached Academy transport. Never follow credential-bearing redirects."""

import hashlib
import json
from urllib.parse import urlsplit

import requests

MAX_PDF_BYTES = 50 * 1024 * 1024
MAX_JSON_BYTES = 2 * 1024 * 1024


class ApiError(Exception):
    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status


# Connection — Only operator configuration selects the API origin.
# Local HTTP is explicit development-only; users cannot supply destinations.
def api_origin(value, allow_local=False):
    value = value.strip().rstrip("/")
    url = urlsplit(value)
    local = allow_local and url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}
    if (url.scheme != "https" and not local) or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
        raise ValueError("Set ACADEMY_API_URL to an HTTPS API origin (without a path).")
    return value


def validate_pdf(data):
    if not data or len(data) > MAX_PDF_BYTES:
        raise ApiError("Choose a PDF up to 50 MiB.")
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
        raise ApiError("Choose a complete PDF file.")
    return data


class AcademyAPI:
    def __init__(self, origin, token=None):
        self.origin = origin
        self.token = token

    # Transport — No retries for writes; retain UI drafts after uncertain outcomes.
    # Limit response bytes even if an upstream omits or lies about Content-Length.
    def request(self, method, path, payload=None, *, data=None, version=None, key=None, pdf=False):
        if not path.startswith("/v1/") or path.startswith("//"):
            raise ValueError("Unsupported API path.")
        headers = {"X-Academy-Features": "choice-forms-v1"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if data is not None:
            validate_pdf(data)
            headers["Content-Type"] = "application/pdf"
        if version is not None:
            headers["X-Item-Version"] = str(version)
        if key:
            headers["Idempotency-Key"] = key
        try:
            with requests.request(method, self.origin + path, json=payload, data=data, headers=headers,
                                  timeout=(5, 125 if data is not None else 30),
                                  allow_redirects=False, stream=True) as response:
                limit = MAX_PDF_BYTES if pdf and response.ok else MAX_JSON_BYTES
                chunks, size = [], 0
                for chunk in response.iter_content(65536):
                    size += len(chunk)
                    if size > limit:
                        raise ApiError("The server response exceeds the allowed size.", 502)
                    chunks.append(chunk)
                content = b"".join(chunks)
                if 300 <= response.status_code < 400:
                    raise ApiError("API redirects are disabled. Check the configured API origin.", 502)
                if not response.ok:
                    try:
                        message = json.loads(content).get("error", "Request failed.")
                    except (ValueError, AttributeError):
                        message = "The API could not complete this request."
                    raise ApiError(str(message), response.status_code)
                if pdf:
                    if response.headers.get("Content-Type", "").split(";")[0] != "application/pdf":
                        raise ApiError("The server did not return a PDF.", 502)
                    validate_pdf(content)
                    digest = response.headers.get("X-Content-SHA256")
                    if not digest or hashlib.sha256(content).hexdigest() != digest:
                        raise ApiError("Material integrity check failed. Try again.", 502)
                    return content
                return json.loads(content)
        except (requests.RequestException, ValueError) as error:
            raise ApiError("Cannot reach the Academy API. Check the connection and try again.") from error

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, payload=None, **kwargs):
        return self.request("POST", path, {} if payload is None else payload, **kwargs)

    def content(self, item_id):
        return self.request("GET", f"/v1/items/{item_id}/content", pdf=True)
