// Les tests de dates (semaines, récurrence, changement d'heure) supposent le fuseau
// Europe/Paris, fixé par jest/global-setup.js : sur une machine en UTC, ils passeraient
// sans rien vérifier
describe("fuseau horaire des tests", () => {
  it("Europe/Paris, avec heure d'été et heure d'hiver", () => {
    expect(process.env.TZ).toBe("Europe/Paris");
    expect(new Date(2026, 6, 1, 12).getTimezoneOffset()).toBe(-120); // été
    expect(new Date(2026, 11, 1, 12).getTimezoneOffset()).toBe(-60); // hiver
  });
});
