import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { CelebrationStyle, CONFETTI_MS, makeParticles, Particle, particleOffset } from "./plan";

export interface Point {
  x: number;
  y: number;
}

function Piece({
  particle,
  origin,
  progress,
}: {
  particle: Particle;
  origin: Point;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = (progress.value * CONFETTI_MS) / 1000;
    const { x, y } = particleOffset(particle, t);
    // Disparition sur le dernier tiers de la chute
    const opacity = progress.value < 0.7 ? 1 : (1 - progress.value) / 0.3;
    return {
      opacity,
      transform: [
        { translateX: origin.x + x },
        { translateY: origin.y + y },
        { rotate: `${particle.spin * t}deg` },
        { scaleY: Math.cos(t * particle.flip) },
      ],
    };
  });

  const height = particle.round ? particle.size : particle.size * 0.45;
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: particle.size,
          height,
          marginLeft: -particle.size / 2,
          marginTop: -height / 2,
          borderRadius: particle.round ? particle.size / 2 : 1.5,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

// Explosion de confettis partant de `origin` (coordonnées de la fenêtre), jouée une fois
export default function Confetti({
  origin,
  celebrationStyle,
}: {
  origin: Point;
  celebrationStyle: CelebrationStyle;
}) {
  const particles = useMemo(() => makeParticles(celebrationStyle), [celebrationStyle]);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: CONFETTI_MS, easing: Easing.linear });
  }, [progress]);

  return (
    <View testID="celebration-confetti" pointerEvents="none" style={styles.layer}>
      {particles.map((particle, i) => (
        <Piece key={i} particle={particle} origin={origin} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  piece: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
