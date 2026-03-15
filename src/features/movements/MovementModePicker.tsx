import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  MOVEMENT_LABELS,
  MOVEMENT_ICONS,
  type MovementMode,
} from "@/core/engine/movementEstimator";

const MODES: MovementMode[] = ["walk", "bicycle", "train", "car", "airplane", "unknown"];

type Props = {
  visible: boolean;
  currentMode: MovementMode;
  onSelect: (mode: MovementMode) => void;
  onClose: () => void;
};

export function MovementModePicker({ visible, currentMode, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={s.title}>移動手段を選択</Text>
          {MODES.map((mode) => {
            const selected = mode === currentMode;
            return (
              <Pressable
                key={mode}
                style={[s.row, selected && s.rowSelected]}
                onPress={() => { onSelect(mode); onClose(); }}
              >
                <Ionicons
                  name={MOVEMENT_ICONS[mode] as any}
                  size={22}
                  color={selected ? "#3b82f6" : "#64748b"}
                />
                <Text style={[s.label, selected && s.labelSelected]}>
                  {MOVEMENT_LABELS[mode]}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={20} color="#3b82f6" style={s.check} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center",
  },
  sheet: {
    width: 280, backgroundColor: "#ffffff", borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  title: {
    fontSize: 15, fontWeight: "600", color: "#0f172a",
    textAlign: "center", marginBottom: 12,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10,
  },
  rowSelected: { backgroundColor: "#eff6ff" },
  label: { fontSize: 16, color: "#334155", flex: 1 },
  labelSelected: { color: "#3b82f6", fontWeight: "600" },
  check: { marginLeft: "auto" },
});
