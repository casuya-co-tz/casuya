from backend.services.public_assets import public_asset_url, rewrite_upload_urls


def test_public_asset_url_requires_https():
    assert public_asset_url("a.png", None) is None
    assert public_asset_url("a.png", "") is None
    assert public_asset_url("a.png", "http://cdn.example/x") is None
    assert public_asset_url("", "https://cdn.casuya.co.tz") is None


def test_public_asset_url_joins_base_and_filename():
    assert (
        public_asset_url("photo.png", "https://cdn.casuya.co.tz/")
        == "https://cdn.casuya.co.tz/photo.png"
    )
    assert (
        public_asset_url("/uploads/photo.png", "https://cdn.casuya.co.tz/media")
        == "https://cdn.casuya.co.tz/media/uploads/photo.png"
    )


def test_public_upload_redirect_key_matches_html_rewrite():
    base = "https://cdn.casuya.co.tz"
    html = rewrite_upload_urls('<img src="/uploads/logo">', base)
    assert 'src="https://cdn.casuya.co.tz/uploads/logo"' in html
    assert public_asset_url("uploads/logo", base) == "https://cdn.casuya.co.tz/uploads/logo"


def test_rewrite_upload_urls_rewrites_src_and_href():
    html = '<img src="/uploads/a.png"><a href="/uploads/b.pdf">x</a><img src="https://x/y.png">'
    out = rewrite_upload_urls(html, "https://cdn.casuya.co.tz")
    assert 'src="https://cdn.casuya.co.tz/uploads/a.png"' in out
    assert 'href="https://cdn.casuya.co.tz/uploads/b.pdf"' in out
    assert 'src="https://x/y.png"' in out
    assert rewrite_upload_urls(html, None) == html
