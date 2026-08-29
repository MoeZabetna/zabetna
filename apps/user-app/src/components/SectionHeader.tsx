import { StyleSheet, Text } from "react-native";
import { color, type as t } from "../theme";

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: { ...t.sectionTitle, color: color.primaryBlack },
});
