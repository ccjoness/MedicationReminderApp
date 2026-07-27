import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout } from '@/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const TabIcon = ({ name, color, size }: { name: IconName; color: string; size: number }) =>
  <MaterialCommunityIcons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textDisabled,
      tabBarStyle: { borderTopWidth: layout.tabBarBorderWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.onPrimary,
      headerTitleStyle: { fontWeight: 'bold' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: (props) => <TabIcon name="target" {...props} /> }} />
      <Tabs.Screen name="missions" options={{ title: 'Missions', tabBarIcon: (props) => <TabIcon name="format-list-checks" {...props} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: (props) => <TabIcon name="calendar-check" {...props} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: (props) => <TabIcon name="account-circle" {...props} /> }} />
    </Tabs>
  );
}
