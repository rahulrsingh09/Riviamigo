import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from northflank_deploy import Halt
from northflank_deploy import free_policy
from test_northflank_deploy import fixture

spec = importlib.util.spec_from_file_location("native_deploy", Path(__file__).parent / "native-release/deploy.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SHA = "a" * 40
NOW = 1791331200


class Fake:
    def __init__(self):
        self.writes = []
        self.fail_ci = False
        self.fail_budget = False
        self.build_sha = SHA
        self.build_success = True
        self.current = {"status": {"deployment": {"status": "COMPLETED"}},
                        "deployment": {"imageUrl": "old-image", "internal": {"deployedSHA": "b" * 40}}}

    def snapshot(self):
        if self.fail_budget:
            raise Halt("paid-usage")
        return {"app": self.current}

    def ci(self, sha, run_id):
        if self.fail_ci:
            raise Halt("ci-not-successful")

    def request(self, path, body=None):
        if body:
            self.writes.append((path, body))
            self.current = {"status": {"deployment": {"status": "COMPLETED"}},
                            "deployment": {"imageUrl": "new-image", "internal": {"deployedSHA": SHA}}}
            return {}
        if "/build/" in path:
            return {"id": "valid-build-1234", "sha": self.build_sha, "status": "SUCCESS",
                    "concluded": True, "success": self.build_success}
        return self.current


class NativeDeploymentTests(unittest.TestCase):
    def test_ci_accepts_only_genuine_protected_push_or_dispatch(self):
        class Metadata(module.Adapter):
            def __init__(self, event, branch=module.BRANCH):
                self.event, self.branch = event, branch

            def request(self, path, body=None, github=False):
                if "/branches/" in path:
                    return {"commit": {"sha": SHA}, "protected": True}
                return {"id": 101, "head_sha": SHA, "head_branch": self.branch,
                        "event": self.event, "workflow_id": 375880117,
                        "path": ".github/workflows/fork-ci.yml",
                        "repository": {"id": 1406366405}, "head_repository": {"id": 1406366405},
                        "status": "completed", "conclusion": "success"}

        for event in ["push", "workflow_dispatch"]:
            Metadata(event).ci(SHA, "101")
        for event in ["pull_request", "schedule", "workflow_run"]:
            with self.assertRaises(Halt):
                Metadata(event).ci(SHA, "101")
        with self.assertRaises(Halt):
            Metadata("workflow_dispatch", "review/candidate").ci(SHA, "101")

    def run_deploy(self, adapter, **overrides):
        args = {"sha": SHA, "run_id": "101", "build_id": "valid-build-1234",
                "attestation": "provider warning\nRIVIAMIGO_NATIVE_backup_OK " + SHA + " " + str(NOW)}
        args.update(overrides)
        return module.deploy(adapter, **args, now=lambda: NOW, sleep=lambda _: None)

    def test_exact_build_is_only_write(self):
        adapter = Fake()
        result = self.run_deploy(adapter)
        self.assertEqual(result["status"], "deployed-awaiting-verification")
        self.assertEqual(adapter.writes, [(module.APP + "/deployment", {"internal": {
            "id": "telemetry-app", "branch": module.BRANCH, "buildId": "valid-build-1234"}})])

    def test_invalid_inputs_and_missing_or_stale_backup_never_write(self):
        cases = [
            {"sha": "$(touch /tmp/forbidden)"}, {"run_id": "1/anything"},
            {"build_id": "../other-service"}, {"attestation": ""},
            {"attestation": "RIVIAMIGO_NATIVE_backup_OK " + "b" * 40 + " " + str(NOW)},
            {"attestation": "RIVIAMIGO_NATIVE_backup_OK " + SHA + " " + str(NOW - 121)},
            {"attestation": "RIVIAMIGO_NATIVE_backup_OK " + SHA + " " + str(NOW + 1)},
        ]
        for case in cases:
            with self.subTest(case=case):
                adapter = Fake()
                with self.assertRaises(Halt):
                    self.run_deploy(adapter, **case)
                self.assertFalse(adapter.writes)

    def test_ci_budget_and_wrong_build_fail_before_deploy(self):
        for field, value in [("fail_ci", True), ("fail_budget", True),
                             ("build_sha", "b" * 40), ("build_success", False)]:
            with self.subTest(field=field):
                adapter = Fake()
                setattr(adapter, field, value)
                with self.assertRaises(Halt):
                    self.run_deploy(adapter)
                self.assertFalse(adapter.writes)

    def test_adapter_rejects_other_projects_and_config_writes(self):
        adapter = module.Adapter("synthetic-token")
        for path, body in [("/v1/projects/other/services/app", None),
                           (module.APP, {"runtimeEnvironment": {"unsafe": "value"}}),
                           (module.APP + "/deployment", {"external": {"image": "bad"}})]:
            with self.subTest(path=path):
                with self.assertRaises(Halt):
                    adapter.request(path, body)

    def test_only_one_included_job_is_allowed(self):
        snapshot = fixture()
        snapshot["jobs"]["jobs"] = [{"id": "verified-release-controller", "jobType": "manual"}]
        snapshot["jobDetails"] = {"verified-release-controller": {
            "billing": {"deploymentPlan": "nf-compute-20"}, "jobType": "manual",
            "settings": {"backoffLimit": 0, "activeDeadlineSeconds": 720, "runOnSourceChange": "never"}}}
        free_policy(snapshot, allowed_jobs=("verified-release-controller",))
        with self.assertRaises(Halt):
            free_policy(snapshot)
        snapshot["jobDetails"]["verified-release-controller"]["billing"]["deploymentPlan"] = "nf-compute-200"
        with self.assertRaises(Halt):
            free_policy(snapshot, allowed_jobs=("verified-release-controller",))


if __name__ == "__main__":
    unittest.main()
