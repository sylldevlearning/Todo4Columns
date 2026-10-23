import appJson from "../../app.json";
import easJson from "../../eas.json";

const android = appJson.expo.android as Record<string, unknown>;

describe("configuration Android (app.json)", () => {
  it("versionCode géré par EAS : absent d'app.json", () => {
    expect(easJson.cli.appVersionSource).toBe("remote");
    expect(android.versionCode).toBeUndefined();
  });
});
