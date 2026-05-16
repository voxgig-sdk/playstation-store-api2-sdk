# PlaystationStoreApi2 SDK test runner

from __future__ import annotations
import os
import json

from utility.voxgig_struct import voxgig_struct as vs


class PlaystationStoreApi2TestRunner:
    _env = {}

    @staticmethod
    def load_env_local():
        try:
            with open("../../.env.local", "r") as f:
                content = f.read()
        except (FileNotFoundError, IOError):
            return

        for line in content.splitlines():
            line = line.strip()
            if line == "" or line.startswith("#"):
                continue
            eq_idx = line.find("=")
            if eq_idx < 0:
                continue
            key = line[:eq_idx].strip()
            val = line[eq_idx + 1:].strip()
            PlaystationStoreApi2TestRunner._env[key] = val

    @staticmethod
    def getenv(key):
        val = PlaystationStoreApi2TestRunner._env.get(key)
        if val is not None:
            return val
        return os.environ.get(key)

    @staticmethod
    def env_override(m):
        live = PlaystationStoreApi2TestRunner.getenv("PROJECTNAME_TEST_LIVE")
        override = PlaystationStoreApi2TestRunner.getenv("PROJECTNAME_TEST_OVERRIDE")

        if live == "TRUE" or override == "TRUE":
            for key in list(m.keys()):
                envval = PlaystationStoreApi2TestRunner.getenv(key)
                if envval is not None and envval != "":
                    envval = envval.strip()
                    if envval.startswith("{"):
                        try:
                            parsed = json.loads(envval)
                            if parsed is not None:
                                m[key] = parsed
                                continue
                        except Exception:
                            pass
                    m[key] = envval

        explain = PlaystationStoreApi2TestRunner.getenv("PROJECTNAME_TEST_EXPLAIN")
        if explain is not None and explain != "":
            m["PROJECTNAME_TEST_EXPLAIN"] = explain

        return m

    _test_control = None

    @staticmethod
    def load_test_control():
        """Load sdk-test-control.json from this test dir; cache after first read.
        Returns a dict with the empty-skip default if the file is missing or invalid
        so tests never crash on a bad config.
        """
        if PlaystationStoreApi2TestRunner._test_control is not None:
            return PlaystationStoreApi2TestRunner._test_control
        ctrl_path = os.path.join(os.path.dirname(__file__), "sdk-test-control.json")
        try:
            with open(ctrl_path, "r") as f:
                PlaystationStoreApi2TestRunner._test_control = json.load(f)
        except (FileNotFoundError, IOError, ValueError):
            PlaystationStoreApi2TestRunner._test_control = {
                "version": 1,
                "test": {"skip": {
                    "live": {"direct": [], "entityOp": []},
                    "unit": {"direct": [], "entityOp": []},
                }},
            }
        return PlaystationStoreApi2TestRunner._test_control

    @staticmethod
    def is_control_skipped(kind, name, mode):
        """Check sdk-test-control.json for a skip entry. Returns (skip, reason)."""
        ctrl = PlaystationStoreApi2TestRunner.load_test_control()
        skip = ctrl.get("test", {}).get("skip", {}).get(mode, {}) or {}
        items = skip.get(kind, []) or []
        for item in items:
            if kind == "direct" and item.get("test") == name:
                return True, item.get("reason")
            if kind == "entityOp":
                key = (item.get("entity") or "") + "." + (item.get("op") or "")
                if key == name:
                    return True, item.get("reason")
        return False, None

    @staticmethod
    def live_delay_ms():
        """Per-test live pacing delay (ms); default 500."""
        ctrl = PlaystationStoreApi2TestRunner.load_test_control()
        v = ctrl.get("test", {}).get("live", {}).get("delayMs")
        if isinstance(v, int) and v >= 0:
            return v
        return 500

    @staticmethod
    def entity_list_to_data(lst):
        out = []
        for item in lst:
            if isinstance(item, dict):
                out.append(item)
            elif hasattr(item, "data_get") and callable(item.data_get):
                d = item.data_get()
                if isinstance(d, dict):
                    out.append(d)
            else:
                out.append(item)
        return out


# Module-level convenience functions.
def load_env_local():
    PlaystationStoreApi2TestRunner.load_env_local()


def env_override(m):
    return PlaystationStoreApi2TestRunner.env_override(m)


def entity_list_to_data(lst):
    return PlaystationStoreApi2TestRunner.entity_list_to_data(lst)


def is_control_skipped(kind, name, mode):
    return PlaystationStoreApi2TestRunner.is_control_skipped(kind, name, mode)


def load_test_control():
    return PlaystationStoreApi2TestRunner.load_test_control()


def live_delay_ms():
    return PlaystationStoreApi2TestRunner.live_delay_ms()
