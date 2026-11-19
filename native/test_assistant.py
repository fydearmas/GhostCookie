import io
import json
import os
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

import assistant


EXTENSION_ID = "a" * 32
EDGE_ID = "b" * 32
OFFICIAL = {"chrome": EXTENSION_ID, "edge": EDGE_ID}
ORIGIN = f"chrome-extension://{EXTENSION_ID}/"
SIGNALS = {
    "blocked": 12,
    "detected": 2,
    "cookies": 3,
    "threat": "none",
    "indicators": ["insecure-http"],
}
CONFIG = {"extension_id": EXTENSION_ID, "model": assistant.DEFAULT_MODEL}
MOCK_KEY = "FictitiousKey_ForUnitTestsOnly"


class NativeHostTests(unittest.TestCase):
    def request(self, message, origin=ORIGIN, config=CONFIG, pinned_ids=None):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "host-config.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            source = io.BytesIO()
            assistant.write_message(source, message)
            source.seek(0)
            response = io.BytesIO()
            assistant.run_host(origin, config_path, source, response, pinned_ids)
            response.seek(0)
            return assistant.read_message(response)

    def test_status_reveals_whether_a_key_exists(self):
        with patch.object(assistant, "load_key", return_value=MOCK_KEY):
            self.assertEqual(self.request({"action": "status"}), {"ok": True, "configured": True})

    def test_origin_mismatch_stops_before_reading_the_key(self):
        with patch.object(assistant, "load_key") as load_key:
            result = self.request({"action": "status"}, f"{ORIGIN}unexpected")
        self.assertEqual(result["code"], "invalid-origin")
        load_key.assert_not_called()

    def test_published_host_accepts_both_pinned_store_origins(self):
        config = {"registrations": OFFICIAL, "model": assistant.DEFAULT_MODEL}
        with patch.object(assistant, "load_key", return_value=MOCK_KEY):
            for origin in (ORIGIN, f"chrome-extension://{EDGE_ID}"):
                with self.subTest(origin=origin):
                    self.assertEqual(self.request({"action": "status"}, origin, config, OFFICIAL), {"ok": True, "configured": True})

    def test_published_host_rejects_locally_injected_extension_id(self):
        unrecognized = "c" * 32
        config = {"registrations": {"chrome": EXTENSION_ID, "edge": unrecognized}, "model": assistant.DEFAULT_MODEL}
        with patch.object(assistant, "load_key") as load_key:
            result = self.request({"action": "status"}, f"chrome-extension://{unrecognized}/", config, OFFICIAL)
        self.assertEqual(result["code"], "host-configuration")
        load_key.assert_not_called()

    def test_browser_cannot_send_key_management_requests(self):
        with patch.object(assistant, "store_key") as store_key:
            result = self.request({"action": "save", "key": MOCK_KEY})
        self.assertEqual(result["code"], "invalid-message")
        store_key.assert_not_called()

    def test_private_setup_pipe_writes_key_without_returning_it(self):
        source = io.BytesIO()
        assistant.write_message(source, {"action": "save", "key": MOCK_KEY})
        source.seek(0)
        target = io.BytesIO()
        with patch.object(assistant, "store_key") as store_key:
            assistant.setup_key_command(source, target)
        store_key.assert_called_once_with(MOCK_KEY)
        target.seek(0)
        self.assertEqual(assistant.read_message(target), {"ok": True, "configured": True})

    def test_unknown_fields_and_indicators_are_rejected_before_provisioning(self):
        samples = (
            dict(SIGNALS, url="https://example.test"),
            dict(SIGNALS, blocked=True),
            dict(SIGNALS, indicators=["unrecognized"]),
        )
        with patch.object(assistant, "load_key") as load_key:
            for signals in samples:
                with self.subTest(signals=signals):
                    self.assertEqual(self.request({"action": "analyze", "signals": signals})["code"], "invalid-message")
        load_key.assert_not_called()

    def test_message_size_is_bounded_before_payload_read(self):
        header = assistant.MESSAGE_HEADER.pack(assistant.MAX_REQUEST_BYTES + 1)
        source = io.BytesIO(header + b'{"action":"status"}')
        with self.assertRaises(assistant.CompanionError) as error:
            assistant.read_message(source)
        self.assertEqual(error.exception.code, "invalid-message")
        self.assertEqual(source.tell(), assistant.MESSAGE_HEADER.size)

    def test_analysis_uses_the_users_key_only_in_the_provider_header(self):
        request = assistant.create_provider_request(MOCK_KEY, CONFIG["model"], SIGNALS)
        headers = {name.lower(): value for name, value in request.header_items()}
        prompt = json.loads(request.data)["contents"][0]["parts"][0]["text"]
        self.assertEqual(headers["x-goog-api-key"], MOCK_KEY)
        self.assertNotIn(MOCK_KEY, request.full_url + prompt)
        self.assertIn('"cookies":3', prompt)

    def test_only_generated_analysis_is_returned(self):
        with (
            patch.object(assistant, "load_key", return_value=MOCK_KEY),
            patch.object(assistant, "analyze", return_value="Resultado de prueba."),
        ):
            result = self.request({"action": "analyze", "signals": SIGNALS})
        self.assertEqual(result, {"ok": True, "text": "Resultado de prueba."})

    def test_unavailable_block_count_reaches_the_provider_as_null(self):
        signals = dict(SIGNALS, blocked=None)
        with (
            patch.object(assistant, "load_key", return_value=MOCK_KEY),
            patch.object(assistant, "analyze", return_value="Sin conteo disponible.") as analyze,
        ):
            result = self.request({"action": "analyze", "signals": signals})
        self.assertTrue(result["ok"])
        analyze.assert_called_once_with(MOCK_KEY, CONFIG["model"], signals)

    def test_thought_parts_are_not_included(self):
        parts = [{"thought": True, "text": "Pensamiento"}, {"text": "Resultado"}]
        raw = json.dumps({"candidates": [{"content": {"parts": parts}}]}).encode()
        self.assertEqual(assistant.extract_analysis(raw), "Resultado")

    def test_provider_output_cannot_echo_the_exact_key(self):
        parts = [{"text": f"Respuesta {MOCK_KEY}"}]
        raw = json.dumps({"candidates": [{"content": {"parts": parts}}]}).encode()
        self.assertEqual(
            assistant.extract_analysis(raw, credential=MOCK_KEY),
            "Respuesta [credencial omitida]",
        )


class RegistrationTests(unittest.TestCase):
    def test_missing_official_ids_are_rejected_before_registration(self):
        with tempfile.TemporaryDirectory() as directory:
            nonexistent = Path(directory) / "missing.json"
            with patch.object(assistant, "OFFICIAL_IDS_PATH", nonexistent):
                with self.assertRaises(assistant.CompanionError) as error:
                    assistant.register_published(nonexistent)
        self.assertEqual(error.exception.code, "official-ids-unavailable")

    def test_published_setup_replaces_legacy_origins_and_preserves_the_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            launcher = root / "ghostcookie-host"
            launcher.touch()
            ids = root / "official-extension-ids.json"
            ids.write_text(json.dumps(OFFICIAL), encoding="utf-8")
            legacy = root / assistant.SOURCE_CONFIG
            legacy.write_text(json.dumps({"extension_id": "c" * 32, "model": "gemini-test"}), encoding="utf-8")
            with (
                patch.object(assistant.sys, "platform", "linux"),
                patch.object(assistant, "OFFICIAL_IDS_PATH", ids),
                patch.object(assistant, "data_dir", return_value=root),
                patch.dict(os.environ, {"CHROME_CONFIG_HOME": directory, "XDG_CONFIG_HOME": directory}),
            ):
                assistant.register_published(launcher)
                config = assistant.read_config(root / assistant.PUBLISHED_CONFIG)
                self.assertEqual(config, {"registrations": OFFICIAL, "model": "gemini-test"})
                chrome_manifest = assistant.manifest_file("chrome", root)
                edge_manifest = assistant.manifest_file("edge", root)
                self.assertEqual(edge_manifest.parent.parent.name, "microsoft-edge")
                for path in (chrome_manifest, edge_manifest):
                    payload = json.loads(path.read_text(encoding="utf-8"))
                    self.assertEqual(payload["allowed_origins"], assistant.allowed_origins(OFFICIAL.values()))
                    self.assertEqual(payload["path"], str(launcher))
                assistant.unregister_published(launcher)
                assistant.unregister_published(launcher)
                self.assertFalse(chrome_manifest.exists())
                self.assertFalse(edge_manifest.exists())
                self.assertTrue(legacy.exists())

    def test_source_cli_adds_edge_alongside_legacy_chrome_registration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / assistant.SOURCE_CONFIG
            config.write_text(json.dumps(CONFIG), encoding="utf-8")
            args = Namespace(browser="edge", extension_id=EDGE_ID, model=assistant.DEFAULT_MODEL, chrome_user_data_dir=root / "edge")
            with (
                patch.object(assistant.sys, "platform", "linux"),
                patch.object(assistant, "data_dir", return_value=root),
                patch("builtins.print"),
            ):
                assistant.install(args)
                self.assertEqual(assistant.read_config(config)["registrations"], OFFICIAL)
                path = assistant.manifest_file("edge", root, args.chrome_user_data_dir)
                manifest = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(manifest["allowed_origins"], assistant.allowed_origins([EDGE_ID]))


if __name__ == "__main__":
    unittest.main()
