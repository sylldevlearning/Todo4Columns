import appJson from "../../app.json";
import easJson from "../../eas.json";

const android = appJson.expo.android as Record<string, unknown>;

describe("configuration Android (app.json)", () => {
  it("versionCode géré par EAS : absent d'app.json", () => {
    expect(easJson.cli.appVersionSource).toBe("remote");
    expect(android.versionCode).toBeUndefined();
  });
});

describe("permissions Android bloquées", () => {
  it("stockage et affichage par-dessus les autres apps : l'app n'en a pas besoin", () => {
    expect(android.blockedPermissions).toEqual(
      expect.arrayContaining([
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ])
    );
  });
});
