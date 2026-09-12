# Container direct test

import json
import pytest

from playstationstoreapi2_sdk.utility.voxgig_struct import voxgig_struct as vs
from playstationstoreapi2_sdk import PlaystationStoreApi2SDK
from playstationstoreapi2_sdk.core import helpers
from test import runner


class TestContainerDirect:

    def test_should_direct_load_container(self):
        setup = _container_direct_setup({"id": "direct01"})
        _skip, _reason = runner.is_control_skipped("direct", "direct-load-container", "live" if setup["live"] else "unit")
        if _skip:
            # pytest already imported at module scope
            pytest.skip(_reason or "skipped via sdk-test-control.json")
            return
        client = setup["client"]

        params = {}
        query = {}
        if setup["live"]:
            params["age_limit"] = "999"
            params["container_id"] = "STORE-MSF75508-FULLGAMES"
            params["country"] = "ch"
            params["language"] = "de"
        else:
            params["age_limit"] = "direct01"
            params["container_id"] = "direct02"
            params["country"] = "direct03"
            params["language"] = "direct04"

        result = client.direct({
            "path": "container/{country}/{language}/{age_limit}/{container_id}",
            "method": "GET",
            "params": params,
            "query": query,
        })
        if setup["live"]:
            # Live mode is lenient: synthetic IDs frequently 4xx. Skip
            # rather than fail when the load endpoint isn't reachable
            # with the IDs we can construct from setup.idmap.
            if result.get("err") is not None:
                pytest.skip(f"load call failed (likely synthetic IDs against live API): {result.get('err')}")
                return
            if not result.get("ok"):
                pytest.skip("load call not ok (likely synthetic IDs against live API)")
                return
            status = helpers.to_int(result["status"])
            if status < 200 or status >= 300:
                pytest.skip(f"expected 2xx status, got {status}")
                return
        else:
            assert result["ok"] is True
            assert helpers.to_int(result["status"]) == 200
            assert result["data"] is not None
            if isinstance(result["data"], dict):
                assert result["data"]["id"] == "direct01"
            assert len(setup["calls"]) == 1



def _container_direct_setup(mockres):
    runner.load_env_local()

    calls = []

    env = runner.env_override({
        "PLAYSTATION_STORE_API2_TEST_CONTAINER_ENTID": {},
        "PLAYSTATION_STORE_API2_TEST_LIVE": "FALSE",
    })

    live = env.get("PLAYSTATION_STORE_API2_TEST_LIVE") == "TRUE"

    if live:
        # sdk-test-control.json's test.client.options seeds the live
        # client; the generated fields below overwrite anything they name.
        merged_opts = dict(runner.live_client_options())
        merged_opts.update({
        })
        client = PlaystationStoreApi2SDK(merged_opts)
        return {
            "client": client,
            "calls": calls,
            "live": True,
            "idmap": {},
        }

    def mock_fetch(url, init):
        calls.append({"url": url, "init": init})
        return {
            "status": 200,
            "statusText": "OK",
            "headers": {},
            "json": lambda: mockres if mockres is not None else {"id": "direct01"},
            "body": "mock",
        }, None

    client = PlaystationStoreApi2SDK({
        "base": "http://localhost:8080",
        "system": {
            "fetch": mock_fetch,
        },
    })

    return {
        "client": client,
        "calls": calls,
        "live": False,
        "idmap": {},
    }
