## 📱 Spark Phone App

### Table of Contents

- [Folder Structure](#folder-structure)
- [Libraries / Dependencies](#libraries--dependencies)

### Folder Structure

```text
├── app/
│   ├── navigation/        # React Navigation stacks/tabs
│   ├── screens/           # Home, DeviceList, UseCase, OTA, Settings
│   ├── store/             # Redux/Zustand state management
│   ├── hooks/             # Custom hooks (useBLE, useDevice)
│   ├── utils/             # Helpers (parsers, encoders, constants)
│   ├── theme/             # Global Theme configuration
│
├── components/
│   ├── common/            # Button, Loader, Modal, Toast
│   ├── custom/            # Custom device designs like DeviceDetailsCard, PopUp Card
│
├── services/
│   ├── ble/
│   │   ├── bleManager.ts      # Scan, connect, disconnect
│   │   ├── bleParser.ts       # Decode raw BLE data
│   │   └── bleCommands.ts     # Read/write characteristics
│   │
│   ├── ota/                #firmware update and model update logic
|       ├── firmware/
│           ├── firmwareService.ts           # Firmware OTA Config, business logic
│           ├── firmwareUploader.ts          # Chunking & BLE write logic
│           ├── firmwareValidator.ts         # Version Checks, checksum,
│           └── firmwareTypes.ts             # Type definitions for firmware objects, e.g., firmware version, file format, progress events, error types
│       ├── model/
│           ├── modelService.ts              # Model config, business logic
│           ├── modelUploader.ts             # Chunking & BLE write logic
│           ├── modelValidator.ts            # Version Checks, checksum,
│           └── modelTypes.ts                # Type definitions for model objects, e.g., firmware version, file format, progress events, error types
│       ├── otaManager.ts                    # Control OTA Logic (FW and Model)
|       ├── otaConstants.ts                  # Common Constants cofiguration ( eg: UUIDs, chunk size)
|       ├── otaErrors.ts                     # Central Error codes and error message mapping
        └── otaTypes.ts                      # Type definitions (eg: OTAtype : FW,Model)
│   │
│   ├── backend/
│   │   └── api.ts              # Fetch OTA, Models files
│   │
│   └── storage/
│       └── secureStore.ts      # Persist device info, current firmware and model version
│
├── types/                      # Global Type definitions how the data should store which format (eg: device: deviceid,devicename)
|
├── assets/
│   ├── images/
│   └── icons/
│
├── scripts/
│   ├── env.ts
│   └── build.ts
│
├── docs/                        # Flow doc, technical doc ,
│   ├── ble-flow.md              # Example doc,
│   ├── ota-flow.md              # Example doc
│   └── architecture.md          # Example doc
│
├── .github/
└── README.md
```

### Libraries / Dependencies

| Library                                     | Purpose                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `react-native`                              | Core framework for building the mobile app                                 |
| `react-native-ble-plx`                      | BLE scanning, connecting, and reading/writing characteristics              |
| `react-native-fs`                           | File handling                                                              |
| `@react-native-async-storage/async-storage` | Non-sensitive local storage                                                |
| `react-native-keychain`                     | Secure storage for device info or credentials or file info                 |
| `@react-navigation/native`                  | App navigation framework                                                   |
| `@react-navigation/native-stack`            | Stack-based navigation                                                     |
| `react-native-screens`                      | Improves navigation performance by using native screen components          |
| `react-native-safe-area-context`            | Ensures content doesn’t get hidden behind notches or status bars           |
| `redux/zustand`                             | State management                                                           |
| `react-native-permissions`                  | Request runtime permissions (Bluetooth)                                    |
| `react-native-logs`                         | Centralized logging for BLE/OTA events                                     |
| `buffer`                                    | Binary data parsing and chunking for BLE                                   |
| `react-native-device-info`                  | Get mobile device info like model, OS version                              |
| `react-native-paper`                        | Modern Material Design UI components for buttons, cards, lists, and modals |
| `react-native-vector-icons`                 | Icons                                                                      |
