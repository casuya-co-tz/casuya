import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.parsers import HTMLParser, CSSParser, JSParser


def test_html_parser_extracts_title():
    p = HTMLParser()
    result = p.parse("<html><head><title>My Lesson</title></head><body></body></html>")
    assert result["title"] == "My Lesson"


def test_html_parser_extracts_meta():
    p = HTMLParser()
    result = p.parse('<html><head><meta name="description" content="Test"></head><body></body></html>')
    assert result["meta"].get("description") == "Test"


def test_html_parser_extracts_stylesheets():
    p = HTMLParser()
    result = p.parse('<html><head><link rel="stylesheet" href="style.css"></head><body></body></html>')
    assert "style.css" in result["stylesheets"]


def test_html_parser_extracts_images():
    p = HTMLParser()
    result = p.parse('<html><body><img src="pic.png"></body></html>')
    assert "pic.png" in result["images"]


def test_html_parser_no_title():
    p = HTMLParser()
    result = p.parse("<html><body><p>No title</p></body></html>")
    assert result["title"] is None


def test_css_parser_extracts_selectors():
    p = CSSParser()
    result = p.parse("body { margin: 0; } .cls { color: red; } #id { padding: 0; }")
    assert len(result["selectors"]) >= 3


def test_css_parser_extracts_imports():
    p = CSSParser()
    result = p.parse('@import "reset.css"; body { margin: 0; }')
    assert "reset.css" in result["imports"]


def test_css_parser_extracts_urls():
    p = CSSParser()
    result = p.parse("body { background: url(bg.png); }")
    assert "bg.png" in result["urls"]


def test_js_parser_detects_eval():
    p = JSParser()
    result = p.parse("var x = eval('1+1')")
    assert result["uses_eval"] == True


def test_js_parser_detects_document_write():
    p = JSParser()
    result = p.parse("document.write('hello')")
    assert result["uses_document_write"] == True


def test_js_parser_extracts_imports():
    p = JSParser()
    result = p.parse("import { foo } from './bar.js'; const x = require('lodash');")
    assert len(result["imports"]) >= 2


if __name__ == "__main__":
    test_html_parser_extracts_title()
    test_html_parser_extracts_meta()
    test_html_parser_extracts_stylesheets()
    test_html_parser_extracts_images()
    test_html_parser_no_title()
    test_css_parser_extracts_selectors()
    test_css_parser_extracts_imports()
    test_css_parser_extracts_urls()
    test_js_parser_detects_eval()
    test_js_parser_detects_document_write()
    test_js_parser_extracts_imports()
    print("All parser tests passed")
