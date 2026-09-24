# PlaystationStoreApi2 SDK utility: fetcher

from __future__ import annotations
import json
import threading
from http.cookiejar import DefaultCookiePolicy
from playstationstoreapi2_sdk.utility.voxgig_struct import voxgig_struct as vs


# Default User-Agent — many CDNs (notably Cloudflare) reject requests with
# a library's default UA, returning 403 before the request even reaches
# the origin. Set a Mozilla-shaped UA so the SDK behaves like every other
# HTTP client by default. Users can still override by passing a User-Agent
# header in fetchdef.
_DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; PlaystationStoreApi2SDK/1.0)"


_SESSION = None
_SESSION_LOCK = threading.Lock()


def _session():
    # Pool connections without retaining response cookies between calls.
    global _SESSION
    if _SESSION is None:
        import requests
        with _SESSION_LOCK:
            if _SESSION is None:
                session = requests.Session()
                session.cookies.set_policy(DefaultCookiePolicy(allowed_domains=[]))
                _SESSION = session
    return _SESSION


def _default_http_fetch(fullurl, fetchdef):
    method = fetchdef.get("method", "GET")
    body_str = fetchdef.get("body")
    headers = fetchdef.get("headers", {})

    if not isinstance(body_str, str):
        body_str = None

    data = body_str.encode("utf-8") if body_str is not None else None

    req_headers = {}
    has_ua = False
    for k, v in headers.items():
        if k.lower() == "user-agent":
            has_ua = True
        req_headers[k] = v
    if not has_ua:
        req_headers["User-Agent"] = _DEFAULT_USER_AGENT

    # Manual redirects: fetchdef["redirect"] == "manual" surfaces a 3xx as
    # an ordinary response instead of auto-following it, which would replay
    # the request, headers included, against whatever host Location names.
    # Set by the station feature's transport middleware under an egress
    # hosts policy (mirrors the ts fetch option).
    kwargs = {"allow_redirects": fetchdef.get("redirect") != "manual"}

    proxy = fetchdef.get("proxy")
    if isinstance(proxy, str) and proxy:
        kwargs["proxies"] = {"http": proxy, "https": proxy}

    timeout = fetchdef.get("timeout")
    if isinstance(timeout, (int, float)) and timeout > 0:
        kwargs["timeout"] = timeout

    try:
        resp = _session().request(method, fullurl, data=data, headers=req_headers, **kwargs)
        body = resp.content.decode("utf-8")
    except Exception as e:
        return None, str(e)

    resp_headers = {}
    for k, v in resp.headers.items():
        resp_headers[k.lower()] = v

    json_body = None
    if len(body) > 0:
        try:
            json_body = json.loads(body)
        except Exception:
            pass

    status = resp.status_code
    status_text = resp.reason or ("OK" if status < 400 else "Error")

    return {
        "status": status,
        "statusText": status_text,
        "headers": resp_headers,
        "json": lambda: json_body,
        "body": body,
    }, None


def fetcher_util(ctx, fullurl, fetchdef):
    if ctx.client.mode != "live":
        return None, ctx.make_error("fetch_mode_block",
            'Request blocked by mode: "' + ctx.client.mode +
            '" (URL was: "' + fullurl + '")')

    options = ctx.client.options_map()
    if vs.getpath(options, "feature.test.active") is True:
        return None, ctx.make_error("fetch_test_block",
            'Request blocked as test feature is active'
            ' (URL was: "' + fullurl + '")')

    sys_fetch = vs.getpath(options, "system.fetch")

    if sys_fetch is None:
        return _default_http_fetch(fullurl, fetchdef)

    if callable(sys_fetch):
        return sys_fetch(fullurl, fetchdef)

    return None, ctx.make_error("fetch_invalid", "system.fetch is not a valid function")
