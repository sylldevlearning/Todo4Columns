import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

// Compte à rebours "MM:SS" : seul ce composant se re-rend chaque seconde
export default function Countdown({ endTs }: { endTs: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diffSec = Math.max(Math.ceil((endTs - now) / 1000), 0);
  const m = Math.floor(diffSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (diffSec % 60).toString().padStart(2, "0");
  return <Text style={styles.timerText}>⏱ {`${m}:${s}`}</Text>;
}

const styles = StyleSheet.create({
  timerText: {
    marginTop: 4,
    fontSize: 14,
    color: "#03DAC6",
    fontWeight: "700",
  },
});
