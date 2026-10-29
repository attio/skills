import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setReleaseField } from "./release.ts";

const CONFIG = 'export default defineConfig({\n  version: "0.1.0",\n  repository: "example/plugins",\n});\n';

describe("setReleaseField", () => {
  it("updates version", () => {
    assert.match(setReleaseField(CONFIG, "version", "0.2.0"), /^ {2}version: "0\.2\.0",$/m);
  });

  it("adds published under version, then updates it", () => {
    const added = setReleaseField(CONFIG, "published", "0.1.0");
    assert.match(added, /version: "0\.1\.0",\n {2}published: "0\.1\.0",\n/);
    assert.match(setReleaseField(added, "published", "0.2.0"), /published: "0\.2\.0",/);
  });

  it("fails when there's no version line", () => {
    assert.throws(() => setReleaseField("export default {};\n", "version", "1.0.0"), /no `version/);
  });
});
