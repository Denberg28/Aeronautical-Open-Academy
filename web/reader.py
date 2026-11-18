"""Render only one bounded page; PDF bytes never enter the student's browser viewer."""

from io import BytesIO
from contextlib import closing

import pypdfium2 as pdfium
import streamlit as st

from web.api import ApiError


# Reader — Bound page count and raster dimensions to limit memory on shared hosting.
def page_image(data, page=0):
    try:
        with closing(pdfium.PdfDocument(data)) as document:
            if not 1 <= len(document) <= 2000:
                raise ApiError("Use an unlocked PDF with 1–2000 pages.")
            page = max(0, min(page, len(document) - 1))
            with closing(document[page]) as source:
                width, height = source.get_size()
                if not width > 0 or not height > 0:
                    raise ApiError("This page cannot be displayed.")
                scale = min(1400 / width, 2000 / height, 2)
                with closing(source.render(scale=scale)) as bitmap:
                    output = BytesIO()
                    with bitmap.to_pil() as image:
                        image.save(output, format="PNG")
                    return output.getvalue(), len(document)
    except ApiError:
        raise
    except Exception as error:
        raise ApiError("Cannot display this PDF. Ask your instructor to check the file.") from error


def read_pdf(api, item):
    # Each page interaction reauthorizes content through the API. No PDF URL or export action.
    key = f"page_{item['id']}_{item['revision']}"
    page = st.session_state.get(key, 0)
    image, total = page_image(api.content(item["id"]), page)
    st.image(image, caption=f"Page {page + 1} of {total}", width="stretch")
    previous, next_page = st.columns(2)
    if previous.button("Previous page", disabled=page <= 0, key="prev_" + key):
        st.session_state[key] = page - 1
        st.rerun()
    if next_page.button("Next page", disabled=page >= total - 1, key="next_" + key):
        st.session_state[key] = page + 1
        st.rerun()
