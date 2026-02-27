import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import Colors from "@/constants/colors";

interface JarvisRingsProps {
  isThinking?: boolean;
  size?: number;
}

function ArcRing({ radius, strokeWidth, color, duration, reverse, isThinking }: {
  radius: number;
  strokeWidth: number;
  color: string;
  duration: number;
  reverse?: boolean;
  isThinking?: boolean;
}) {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    const dir = reverse ? -1 : 1;
    rotation.value = withRepeat(
      withTiming(dir * 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
    if (isThinking) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.4, { duration: 400 })
        ),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(0.6, { duration: 300 });
    }
  }, [isThinking]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  const circumference = 2 * Math.PI * radius;
  const dashLength = circumference * 0.35;
  const gapLength = circumference * 0.65;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, animStyle]}>
      <Svg width={radius * 2 + strokeWidth * 2} height={radius * 2 + strokeWidth * 2}>
        <Circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dashLength} ${gapLength}`}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function CorePulse({ isThinking }: { isThinking?: boolean }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (isThinking) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1800 }),
          withTiming(0.3, { duration: 1800 })
        ),
        -1,
        true
      );
    }
  }, [isThinking]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.coreContainer, scaleStyle]}>
      <Animated.View style={[styles.coreGlow, glowStyle]} />
      <View style={styles.coreInner} />
      <View style={styles.coreDot} />
    </Animated.View>
  );
}

export function JarvisRings({ isThinking = false, size = 160 }: JarvisRingsProps) {
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <ArcRing radius={size * 0.46} strokeWidth={1.5} color={Colors.jarvis.dim} duration={12000} isThinking={isThinking} />
      <ArcRing radius={size * 0.38} strokeWidth={2} color={Colors.jarvis.dimLight} duration={8000} reverse isThinking={isThinking} />
      <ArcRing radius={size * 0.30} strokeWidth={2.5} color={Colors.jarvis.blue} duration={5000} isThinking={isThinking} />
      <ArcRing radius={size * 0.22} strokeWidth={1.5} color={Colors.jarvis.cyan} duration={3500} reverse isThinking={isThinking} />
      <CorePulse isThinking={isThinking} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  coreContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  coreGlow: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.jarvis.blue,
    opacity: 0.4,
  },
  coreInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 2,
    borderColor: Colors.jarvis.blue,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  coreDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.jarvis.cyan,
    zIndex: 3,
  },
});
