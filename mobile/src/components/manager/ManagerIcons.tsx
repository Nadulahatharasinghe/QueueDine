import React from "react";
import { StyleSheet, View, Text, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

const burgundy = "#801D26";
const slate = "#697386";

export interface IconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

// 1. QueueDine Flame / Candle Brand Symbol
export function BrandFlame({ size = 32 }: { size?: number }) {
  return (
    <View style={[styles.brandFlameBox, { width: size, height: size * 1.25 }]}>
      <View style={[styles.flameStem, { height: size * 1.2 }]} />
      <View style={[styles.flameRing, { top: size * 0.1, width: size * 0.65, height: size * 0.45 }]} />
      <View style={[styles.flameRing, { top: size * 0.38, width: size * 0.65, height: size * 0.45 }]} />
      <View style={[styles.flameRing, { top: size * 0.66, width: size * 0.65, height: size * 0.45 }]} />
    </View>
  );
}

// 2. Bell Icon (Notification outline)
export function BellIcon({ size = 20, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.bellDome, { borderColor: color, width: size * 0.75, height: size * 0.65 }]} />
      <View style={[styles.bellBase, { backgroundColor: color, width: size * 0.9, height: 1.5 }]} />
      <View style={[styles.bellClapper, { backgroundColor: color, width: size * 0.25, height: size * 0.15 }]} />
    </View>
  );
}

// 3. User Avatar Monogram (Executive styling)
export function UserAvatar({ initials = "RP", size = 36 }: { initials?: string; size?: number }) {
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

// 4. Calendar Icon Outline
export function CalendarIcon({ size = 16, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.calBody, { borderColor: color, width: size * 0.9, height: size * 0.85 }]}>
        <View style={[styles.calHeaderLine, { backgroundColor: color, height: size * 0.22 }]} />
      </View>
      <View style={[styles.calPin, { backgroundColor: color, left: size * 0.22 }]} />
      <View style={[styles.calPin, { backgroundColor: color, right: size * 0.22 }]} />
    </View>
  );
}

// 5. Refresh Icon
export function RefreshIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size, color, fontWeight: "700", lineHeight: size + 2 }}>↻</Text>
    </View>
  );
}

// 6. Filter / Sliders Icon
export function FilterIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size, justifyContent: "space-around" }]}>
      <View style={[styles.filterBar, { backgroundColor: color }]}>
        <View style={[styles.filterKnob, { borderColor: color, left: 3 }]} />
      </View>
      <View style={[styles.filterBar, { backgroundColor: color }]}>
        <View style={[styles.filterKnob, { borderColor: color, right: 3 }]} />
      </View>
      <View style={[styles.filterBar, { backgroundColor: color }]}>
        <View style={[styles.filterKnob, { borderColor: color, left: 6 }]} />
      </View>
    </View>
  );
}

// 7. Download Icon Outline
export function DownloadIcon({ size = 18, color = burgundy }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.downloadArrowStem, { backgroundColor: color, height: size * 0.55 }]} />
      <View style={[styles.downloadArrowHead, { borderTopColor: color, borderLeftColor: "transparent", borderRightColor: "transparent" }]} />
      <View style={[styles.downloadTray, { borderColor: color, width: size * 0.85, height: size * 0.3 }]} />
    </View>
  );
}

// 8. Trash Icon Outline
export function TrashIcon({ size = 18, color = "#D92D4B" }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.trashLid, { backgroundColor: color, width: size * 0.75 }]} />
      <View style={[styles.trashBody, { borderColor: color, width: size * 0.6, height: size * 0.65 }]} />
    </View>
  );
}

// 9. Clock Icon Outline
export function ClockIcon({ size = 16, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.clockCircle, { borderColor: color, width: size * 0.9, height: size * 0.9 }]}>
        <View style={[styles.clockHourHand, { backgroundColor: color, height: size * 0.28 }]} />
        <View style={[styles.clockMinHand, { backgroundColor: color, width: size * 0.25 }]} />
      </View>
    </View>
  );
}

// 10. Trending Up Icon
export function TrendUpIcon({ size = 16, color = "#0E9384" }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 1.1, color, fontWeight: "800", lineHeight: size + 2 }}>↗</Text>
    </View>
  );
}

// 11. Warning Triangle Outline
export function WarningIcon({ size = 16, color = "#F79009" }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 1.1, color, fontWeight: "800", lineHeight: size + 2 }}>⚠</Text>
    </View>
  );
}

// 12. Checkmark Icon
export function CheckIcon({ size = 16, color = "#0E9384" }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 1.1, color, fontWeight: "800", lineHeight: size + 2 }}>✓</Text>
    </View>
  );
}

// 13. Table Outline Icon
export function TableOutlineIcon({ size = 16, color = "#2E90FA" }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.tableTop, { backgroundColor: color, width: size * 0.9 }]} />
      <View style={[styles.tableLegRow, { width: size * 0.75, height: size * 0.45 }]}>
        <View style={[styles.tableLeg, { backgroundColor: color }]} />
        <View style={[styles.tableLeg, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

// 14. Settings Cog Icon
export function SettingsIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size, color, fontWeight: "600" }}>⚙</Text>
    </View>
  );
}

// 15. Shield Icon
export function ShieldIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: size, color, fontWeight: "600" }}>🛡</Text>
    </View>
  );
}

// 16. Help Icon
export function HelpIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.circleBadge, { borderColor: color, width: size * 0.9, height: size * 0.9 }]}>
        <Text style={{ fontSize: size * 0.55, color, fontWeight: "700" }}>?</Text>
      </View>
    </View>
  );
}

// 17. Info Icon
export function InfoIcon({ size = 18, color = slate }: IconProps) {
  return (
    <View style={[styles.iconWrap, { width: size, height: size }]}>
      <View style={[styles.circleBadge, { borderColor: color, width: size * 0.9, height: size * 0.9 }]}>
        <Text style={{ fontSize: size * 0.55, color, fontWeight: "700" }}>i</Text>
      </View>
    </View>
  );
}

// 18. Chevron Down Icon (Exact centered SVG vector)
export function ChevronDownIcon({ size = 12, color = slate }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <Path d="M2.5 4.5L6 8L9.5 4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// 19. Chevron Right Icon
export function ChevronRightIcon({ size = 14, color = slate }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <Path d="M4.5 2.5L8 6L4.5 9.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// 20. Chevron Left Icon
export function ChevronLeftIcon({ size = 16, color = "#151D2E" }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <Path d="M10 3.5L5.5 8L10 12.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// 21. Edit Pencil Icon
export function EditIcon({ size = 16, color = slate }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 22. Lock / Password Icon
export function LockIcon({ size = 16, color = slate }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 23. Close / Cross Icon
export function CloseIcon({ size = 16, color = slate }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  brandFlameBox: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  flameStem: {
    position: "absolute",
    width: 2.5,
    backgroundColor: "#CF944D",
    borderRadius: 2,
  },
  flameRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#CF944D",
    borderRadius: 10,
  },
  bellDome: {
    borderWidth: 1.5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  bellBase: {
    borderRadius: 1,
    marginTop: -0.5,
  },
  bellClapper: {
    borderRadius: 2,
    marginTop: 1,
  },
  avatarCircle: {
    backgroundColor: "#F2F4F7",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontWeight: "700",
    color: "#344054",
  },
  calBody: {
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  calHeaderLine: {
    width: "100%",
  },
  calPin: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 3.5,
    borderRadius: 1,
  },
  filterBar: {
    width: "100%",
    height: 1.5,
    borderRadius: 1,
    position: "relative",
  },
  filterKnob: {
    position: "absolute",
    top: -2.5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
  },
  downloadArrowStem: {
    width: 2,
    borderRadius: 1,
  },
  downloadArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    marginTop: -1,
  },
  downloadTray: {
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginTop: 2,
  },
  trashLid: {
    height: 2,
    borderRadius: 1,
    marginBottom: 1,
  },
  trashBody: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  clockCircle: {
    borderWidth: 1.5,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  clockHourHand: {
    position: "absolute",
    width: 1.5,
    borderRadius: 1,
    top: "25%",
  },
  clockMinHand: {
    position: "absolute",
    height: 1.5,
    borderRadius: 1,
    left: "50%",
  },
  tableTop: {
    height: 2.5,
    borderRadius: 1,
  },
  tableLegRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  tableLeg: {
    width: 2,
    height: "100%",
  },
  circleBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
