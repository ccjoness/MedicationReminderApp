import { useState, useEffect } from 'react';
import DeviceTimeFormat from 'react-native-device-time-format';

/**
 * Returns whether the device's system clock is set to 24-hour format.
 *
 * Reads from the Android system settings. Defaults to false (12-hour)
 * during the initial async check so the UI renders immediately and
 * updates without a flash once the preference is known.
 */
export function useIs24HourFormat(): boolean {
  const [is24Hour, setIs24Hour] = useState(false);

  useEffect(() => {
    DeviceTimeFormat.is24HourFormat()
      .then(setIs24Hour)
      .catch(() => {
        // If the native call fails, leave the default (12-hour)
      });
  }, []);

  return is24Hour;
}
