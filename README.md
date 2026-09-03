# BrainChip Connect

This repository contains **BrainChip Connect**, the companion mobile application for AkidaTag devices, providing configuration, monitoring, and OTA management.

The application enables:

- BLE communication with AkidaTag hardware
- Device provisioning and configuration
- Application selection and OTA updates
- Sensor data visualization
- Device health and status monitoring

---

## Supported Platforms

- **Android**
- **iOS**

The application is designed using a **single shared codebase** to support both platforms.

---

## Repository Structure

```text
Folder Structure

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
│   └── clean_generated_files.sh   # Remove generated files this repo ignores
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

### BLE library patch (Android only) (temporary)

With `react-native-ble-plx@3.5.0` on React Native `0.83.x`, we hit a native crash when a BLE monitor errors/cancels:

- `java.lang.NullPointerException: Parameter specified as non-null is null: method com.facebook.react.bridge.PromiseImpl.reject, parameter code`

Root cause: on Android, `SafePromise` sometimes calls `promise.reject(code, …)` with a null/empty `code`, which newer React Native does not allow.

We ship a small patch to `react-native-ble-plx` using `patch-package` so this is applied automatically on all machines.

#### How the patch is set up

- Patched file:

  - `node_modules/react-native-ble-plx/android/src/main/java/com/bleplx/utils/SafePromise.java`

- Change: in all `reject(String code, …)` overloads, we default `code` if it is null/empty:

  ```java
  if (code == null || code.isEmpty()) {
    code = "E_BLE_ERROR";
  }

  ```

- Patch file (committed to the repo):

  - `patches/react-native-ble-plx+3.5.0.patch`

- package.json includes:

  ```
  "scripts": {
      ...,
      "postinstall": "patch-package",
  }

  ```

- After cloning / pulling:

  - `npm ci`
    This project commits `package-lock.json`, so npm is the supported package
    manager and `npm ci` installs exactly the locked tree. Use `npm install` only
    when you intend to change a dependency, and commit the updated lockfile with
    it. Do not use yarn: it would resolve its own tree and silently diverge from
    what CI installs.
    The postinstall script runs patch-package and applies the BLE patch automatically.

  - If you ever need to regenerate the patch after modifying SafePromise.java:

        - `npx patch-package react-native-ble-plx`

    This updates patches/react-native-ble-plx+3.5.0.patch – commit that file.

  - This patch is Android-only (Java side).
