// Fuseau horaire fixe pour tous les tests : les calculs de semaines, de récurrence et de
// changement d'heure sont vérifiés en Europe/Paris, quel que soit le fuseau de la machine
module.exports = async () => {
  process.env.TZ = "Europe/Paris";
};
