import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isAfterToday(d: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() > today.getTime();
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

type CalendarPickerProps = {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
};

export function CalendarPicker({ visible, selectedDate, onSelect, onClose }: CalendarPickerProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    const now = new Date();
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth())) return;
    setViewMonth(nextMonth);
    if (viewMonth === 11) setViewYear((y) => y + 1);
  }, [viewYear, viewMonth]);

  const days = getMonthDays(viewYear, viewMonth);
  const today = new Date();

  const isNextDisabled = (() => {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    return nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonth > today.getMonth());
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={goToPrevMonth} style={styles.monthBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color="#3b82f6" />
            </Pressable>
            <Text style={styles.monthTitle}>
              {viewYear}年{viewMonth + 1}月
            </Text>
            <Pressable
              onPress={goToNextMonth}
              style={[styles.monthBtn, isNextDisabled && { opacity: 0.3 }]}
              disabled={isNextDisabled}
              hitSlop={8}
            >
              <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
            </Pressable>
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[styles.weekLabel, i === 0 && { color: "#ef4444" }, i === 6 && { color: "#3b82f6" }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Day Grid */}
          <View style={styles.dayGrid}>
            {days.map((day, i) => {
              if (!day) {
                return <View key={`e-${i}`} style={styles.dayCell} />;
              }
              const isSelected = sameDay(day, selectedDate);
              const isToday = sameDay(day, today);
              const isFuture = isAfterToday(day);
              const dayOfWeek = day.getDay();

              return (
                <Pressable
                  key={day.getTime()}
                  style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                  onPress={() => {
                    if (!isFuture) {
                      onSelect(day);
                      onClose();
                    }
                  }}
                  disabled={isFuture}
                >
                  <Text
                    style={[
                      styles.dayText,
                      dayOfWeek === 0 && { color: "#ef4444" },
                      dayOfWeek === 6 && { color: "#3b82f6" },
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                      isFuture && { color: "#cbd5e1" },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: "#fff" }]} />}
                </Pressable>
              );
            })}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickRow}>
            <Pressable
              style={styles.quickBtn}
              onPress={() => { onSelect(today); onClose(); }}
            >
              <Text style={styles.quickBtnText}>今日</Text>
            </Pressable>
            <Pressable
              style={styles.quickBtn}
              onPress={() => { onSelect(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)); onClose(); }}
            >
              <Text style={styles.quickBtnText}>昨日</Text>
            </Pressable>
            <Pressable
              style={styles.quickBtn}
              onPress={() => { onSelect(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)); onClose(); }}
            >
              <Text style={styles.quickBtnText}>1週間前</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: 320,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  monthBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  dayCellSelected: {
    backgroundColor: "#3b82f6",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },
  dayTextToday: {
    fontWeight: "700",
    color: "#3b82f6",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3b82f6",
    marginTop: 1,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3b82f6",
  },
});
