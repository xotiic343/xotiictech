"""Tests for bot.parser — covers all 8+ layout formats."""

import pytest
from bot.parser import detect_format, parse_entries


class TestDetectFormat:
    """Auto-detection heuristics."""

    def test_one_entry_per_line(self):
        raw = "alice\nbob\ncharlie"
        assert detect_format(raw) == "line"

    def test_blank_separated(self):
        raw = "block one line1\nblock one line2\n\nblock two line1\nblock two line2"
        assert detect_format(raw) == "blank_separated"

    def test_dash_separated(self):
        raw = "entry one\n---\nentry two\n---\nentry three"
        assert detect_format(raw) == "dash_separated"

    def test_equals_separated(self):
        raw = "entry one\n===\nentry two\n===\nentry three"
        assert detect_format(raw) == "dash_separated"

    def test_numbered(self):
        raw = "1. First item\n2. Second item\n3. Third item"
        assert detect_format(raw) == "numbered"

    def test_pipe_fields(self):
        raw = "alice | pass123 | steam\nbob | qwerty | epic"
        assert detect_format(raw) == "pipe_fields"

    def test_key_value_block_dash(self):
        raw = "username: alice\npassword: secret\n---\nusername: bob\npassword: hunter2"
        assert detect_format(raw) == "key_value_block"

    def test_key_value_block_blank(self):
        raw = "username: alice\npassword: secret\n\nusername: bob\npassword: hunter2"
        assert detect_format(raw) == "key_value_block"

    def test_comma_fields(self):
        raw = "alice,pass123,steam\nbob,qwerty,epic"
        assert detect_format(raw) == "comma_fields"

    def test_tab_fields(self):
        raw = "alice\tpass123\tsteam\nbob\tqwerty\tepic"
        assert detect_format(raw) == "tab_fields"

    def test_url_per_line(self):
        raw = "https://example.com/a\nhttps://example.com/b\nhttps://example.com/c"
        assert detect_format(raw) == "url_per_line"

    def test_empty_returns_line(self):
        assert detect_format("") == "line"
        assert detect_format("   \n  \n  ") == "line"


class TestParseEntries:
    """Parsing with a known format."""

    def test_line(self):
        raw = "a\nb\nc"
        entries = parse_entries(raw, "line")
        assert entries == ["a", "b", "c"]

    def test_blank_separated(self):
        raw = "line1\nline2\n\nline3\nline4"
        entries = parse_entries(raw, "blank_separated")
        assert len(entries) == 2
        assert "line1" in entries[0]
        assert "line3" in entries[1]

    def test_dash_separated(self):
        raw = "entry A\n---\nentry B\n---\nentry C"
        entries = parse_entries(raw, "dash_separated")
        assert entries == ["entry A", "entry B", "entry C"]

    def test_numbered(self):
        raw = "1. First\n2. Second\n3. Third"
        entries = parse_entries(raw, "numbered")
        assert entries == ["First", "Second", "Third"]

    def test_numbered_multiline(self):
        raw = "1. First line\n   continued\n2. Second"
        entries = parse_entries(raw, "numbered")
        assert len(entries) == 2
        assert "continued" in entries[0]

    def test_pipe_fields(self):
        raw = "a | b | c\nd | e | f"
        entries = parse_entries(raw, "pipe_fields")
        assert len(entries) == 2
        assert entries[0] == "a | b | c"

    def test_key_value_block(self):
        raw = "user: alice\npass: 123\n---\nuser: bob\npass: 456"
        entries = parse_entries(raw, "key_value_block")
        assert len(entries) == 2
        assert "alice" in entries[0]
        assert "bob" in entries[1]

    def test_comma_fields(self):
        raw = "a,b,c\nd,e,f"
        entries = parse_entries(raw, "comma_fields")
        assert entries == ["a,b,c", "d,e,f"]

    def test_tab_fields(self):
        raw = "a\tb\tc\nd\te\tf"
        entries = parse_entries(raw, "tab_fields")
        assert entries == ["a\tb\tc", "d\te\tf"]

    def test_url_per_line(self):
        raw = "https://example.com/1\nhttps://example.com/2"
        entries = parse_entries(raw, "url_per_line")
        assert len(entries) == 2

    def test_empty_input(self):
        assert parse_entries("", "line") == []
        assert parse_entries("   ", "blank_separated") == []

    def test_strips_whitespace(self):
        raw = "  hello  \n  world  "
        entries = parse_entries(raw, "line")
        assert entries == ["hello", "world"]
