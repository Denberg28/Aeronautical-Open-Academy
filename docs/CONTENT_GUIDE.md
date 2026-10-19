# Instructor content maintenance

## Establish access first

Confirm ownership, intended student audience, licensing, organization sharing restrictions, and whether offline copies are allowed. Do not expose private student information or assume a Drive account's files are open educational resources.

This initial app can fetch a catalog and download approved PDFs without app authentication. An organization sign-in requirement is supported only through the explicit browser-opening action. If your organization forbids unauthenticated access, retain its permissions and treat in-app Drive integration as blocked until an appropriate authentication flow is implemented. Never paste a service-account key, account password, OAuth token, or privileged URL into the catalog.

## Publish a catalog

1. Prepare one approved PDF and a plain-text companion. Verify that its download endpoint returns PDF bytes for the intended student, not a webpage or an HTML confirmation screen.
2. Create a catalog using the structure below. Stable subject IDs determine printed QR payloads. Resource IDs must be globally unique. Keep the same IDs over time.
3. Use the actual HTTPS viewing URL as `source`, and the tested content/export URL as `downloadUrl`. Browser viewing alone does not establish download access. Google Docs-format documents need an eligible export endpoint rather than a binary-file assumption.
4. Compute the exact PDF SHA-256 and include it. A missing checksum is allowed by the initial schema but removes expected-content verification; use checksums for approved distribution.
5. Run `python3 tools/validate_catalog.py catalog.json`. Upload the JSON file to the approved organization location. Verify its content URL returns the JSON itself.
6. In the app, choose Help → Catalog setup and enter the instructor-approved catalog content URL. A successful validation replaces the sample catalog. Only one remote catalog source is supported per installation in this version.
7. Test the same catalog and PDF on the actual student access level and on a phone. Record the evidence before promoting a release.

```json
{
  "schemaVersion": 1,
  "version": 1,
  "title": "Aeronautical Open Academy",
  "subjects": [{
    "id": "ae-413",
    "code": "AE 413",
    "title": "Basic Propeller and Helicopter",
    "description": "Approved subject description from the instructor.",
    "resources": [{
      "id": "ae-413-module-1",
      "module": "Module 1",
      "title": "Introduction",
      "description": "Describe the learning material and prerequisites.",
      "source": "https://drive.google.com/file/d/REPLACE_WITH_APPROVED_FILE_ID/view",
      "downloadUrl": "https://drive.usercontent.google.com/download?id=REPLACE_WITH_APPROVED_FILE_ID&export=download",
      "downloadable": true,
      "mimeType": "application/pdf",
      "revision": 1,
      "sha256": "",
      "license": "Replace with the verified license/permission and attribution.",
      "text": "Provide an accessible plain-text companion (up to 12000 characters)."
    }]
  }]
}
```

The example is structural and is not a working organization link. Download/export access, redirects, file type, size, organization policy, and Google's service behavior require testing. HTML confirmation pages are rejected rather than scraped. No Google Drive API key or account credential is embedded in the app.

## Update without breaking QR codes

- QR value: `aoa://subject/ae-413`; manual input: `AE-413`. The app resolves this through the current catalog, so replacing a resource does not change the subject QR.
- Preserve `id`; update titles/descriptions freely; increase top-level `version` for every published catalog change.
- Increase resource `revision` whenever its PDF, checksum, or download URL changes. Never change a PDF silently under an unchanged revision.
- Update `sha256` for new bytes. A student keeps the old offline copy until a new revision passes verification and its metadata is committed.
- Keep prior catalog/PDF versions in a controlled instructor archive. To recover content, publish a corrected catalog with a higher catalog version and higher affected resource revisions. The app rejects downgrades.
- To retire a subject, retain its ID, set `retired: true`, explain its replacement in the description, and use an empty resource list if appropriate. Printed QR codes then explain retirement. Existing saved copies remain in Downloads.
- Keep captions, readable text, attribution, and document accessibility with the material. The app's PDF page viewer does not generate semantic text from arbitrary scanned pages.

## Useful commands

```sh
sha256sum lesson.pdf
python3 tools/validate_catalog.py catalog.json
```

PowerShell checksum: `Get-FileHash .\lesson.pdf -Algorithm SHA256`.

Bundled samples can be regenerated with `python3 tools/generate_samples.py` after installing the documented authoring dependency. Committed PDFs/catalog are sufficient for app builds; regeneration is not a build prerequisite.

QR production can use any approved offline QR generator with the exact stable payload. Test the printed code with the app before distributing it. Universal scanner routing/install pages are outside this version.
