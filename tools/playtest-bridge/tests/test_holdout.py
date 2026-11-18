import pytest

from gb_bridge.holdout import assert_rids_allowed, parse_rid_spec


def test_parse_rid_spec():
    assert parse_rid_spec("0-2,5") == [0, 1, 2, 5]


def test_holdout_rejected_without_approval():
    with pytest.raises(PermissionError):
        assert_rids_allowed([55], None, "")