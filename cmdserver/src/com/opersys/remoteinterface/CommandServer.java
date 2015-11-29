package com.opersys.remoteinterface;

import android.content.Context;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.os.SystemClock;
import android.util.Log;
import android.view.*;
import jp.co.cyberagent.stf.compat.InputManagerWrapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.StringTokenizer;

/**
 * Tiny console program that sits around and receive notification from the window manager when
 * the device is rotated.
 *
 * https://github.com/openstf/STFService.apk/blob/master/app/src/main/java/jp/co/cyberagent/stf/monitor/RotationMonitor.java
 */
public class CommandServer {

    private static String TAG = "RI.CommandServer";

    private static void setInitialRotation(int n) {
        IWindowManager wm;

        wm = IWindowManager.Stub.asInterface(ServiceManager.getService(Context.WINDOW_SERVICE));

        try {
            wm.freezeRotation(n);
            wm.thawRotation();
        } catch (RemoteException ex) {
            Log.e(TAG, "Failed to set rotation", ex);
        }
    }

    private static class CommandHandlerThread extends Thread {
        private static String TAG = "RI.CommandServer.CommandHandlerThread";

        private BufferedReader br;
        private IWindowManager wm;
        private InputManagerWrapper inputManager;
        private KeyCharacterMap keyCharacterMap;

        private int deviceId = -1; // KeyCharacterMap.VIRTUAL_KEYBOARD

        private void selectDevice() {
            try {
                deviceId = KeyCharacterMap.class.getDeclaredField("VIRTUAL_KEYBOARD").getInt(KeyCharacterMap.class);
            }
            catch (NoSuchFieldException e) {
                System.err.println("Falling back to KeyCharacterMap.BUILT_IN_KEYBOARD");
                deviceId = 0;
            }
            catch (IllegalAccessException e) {
                e.printStackTrace();
                System.exit(1);
            }
        }

        private void loadKeyCharacterMap() {
            keyCharacterMap = KeyCharacterMap.load(deviceId);
        }

        private void keyDown(int keyCode, int metaState) {
            long time = SystemClock.uptimeMillis();
            inputManager.injectKeyEvent(new KeyEvent(
                    time,
                    time,
                    KeyEvent.ACTION_DOWN,
                    keyCode,
                    0,
                    metaState,
                    deviceId,
                    0,
                    KeyEvent.FLAG_FROM_SYSTEM,
                    InputDevice.SOURCE_KEYBOARD
            ));
        }

        private void keyUp(int keyCode, int metaState) {
            long time = SystemClock.uptimeMillis();
            inputManager.injectKeyEvent(new KeyEvent(
                    time,
                    time,
                    KeyEvent.ACTION_UP,
                    keyCode,
                    0,
                    metaState,
                    deviceId,
                    0,
                    KeyEvent.FLAG_FROM_SYSTEM,
                    InputDevice.SOURCE_KEYBOARD
            ));
        }

        private void type(String text) {
            KeyEvent[] events = keyCharacterMap.getEvents(text.toCharArray());

            for (KeyEvent event : events) {
                inputManager.injectKeyEvent(event);
            }
        }

        public void run() {
            try {
                while (true) {
                    String cmd, c;
                    StringTokenizer st;

                    cmd = br.readLine();
                    st = new StringTokenizer(cmd);
                    c = st.nextToken(" ");

                    Log.d(TAG, "Received command: " + cmd);

                    // Rotate command.
                    if ("rotate".equals(c)) {
                        int crot, rot = Surface.ROTATION_0;

                        crot = Integer.parseInt(st.nextToken(" "));

                        switch (crot) {
                            case 0:   rot = Surface.ROTATION_0;   break;
                            case 90:  rot = Surface.ROTATION_90;  break;
                            case 180: rot = Surface.ROTATION_180; break;
                            case 270: rot = Surface.ROTATION_270; break;
                        }

                        try {
                            Log.d(TAG, "Setting rotation to " + rot);

                            wm.freezeRotation(rot);
                            wm.thawRotation();
                        } catch (RemoteException ex) {
                            Log.e(TAG, "Exception while trying to change rotation", ex);
                        }
                    }
                    else if ("keydown".equals(c)) {
                        int code = Integer.parseInt(st.nextToken(" "));
                        keyDown(code, 0);
                    }
                    else if ("keyup".equals(c)) {
                        int code = Integer.parseInt(st.nextToken(" "));
                        keyUp(code, 0);
                    }
                    else if ("type".equals(c)) {
                        String str = cmd.substring("type".length() + 1);
                        type(str);
                    }
                    // Unknown command.
                    else {
                        Log.e(TAG, "Don't know what to do with the command line: " + cmd);
                    }
                }
            } catch (IOException ex) {
                Log.e(TAG, "Read error", ex);
            }

            Log.d(TAG, "Command Handler Thread is ENDING");
        }

        public CommandHandlerThread() {
            this.br = new BufferedReader(new InputStreamReader(System.in));
            this.wm = IWindowManager.Stub.asInterface(ServiceManager.getService(Context.WINDOW_SERVICE));
            this.inputManager = new InputManagerWrapper();

            selectDevice();
            loadKeyCharacterMap();
        }
    }

    private static class RotationWatcherThread extends Thread {
        private static String TAG = "RI.CommandServer.RotationWatcherThread";

        IRotationWatcher watcher = new IRotationWatcher.Stub() {
            @Override
            public void onRotationChanged(int rotation) throws RemoteException {
                int deg;

                deg = rotationToDegrees(rotation);
                Log.d(TAG, "Received rotation: " + deg);

                System.out.println(deg);
            }
        };

        private int rotationToDegrees(int rotation) {
            switch (rotation) {
                case Surface.ROTATION_0:
                    return 0;
                case Surface.ROTATION_90:
                    return 90;
                case Surface.ROTATION_180:
                    return 180;
                case Surface.ROTATION_270:
                    return 270;
                default:
                    return 0;
            }
        }

        public void run() {
            IWindowManager wm;

            try {
                wm = IWindowManager.Stub.asInterface(ServiceManager.getService(Context.WINDOW_SERVICE));
                wm.watchRotation(watcher);

                synchronized (this) {
                    while (!isInterrupted()) {
                        wait();
                    }
                }
            } catch (RemoteException e) {
                Log.e(TAG, "Remote exception while talking to the window manager service", e);
            } catch (InterruptedException e) {
                Log.e(TAG, "Interruption while talking to the window manager service", e);
            }

            Log.d(TAG, "Rotation Watcher Thread is ENDING");
        }
    }

    public static void main(String args[]) {
        Thread rotWatcher, cmdHandler;

        setInitialRotation(Surface.ROTATION_0);

        Log.d(TAG, "Starting CommandServer");

        rotWatcher = new RotationWatcherThread();
        cmdHandler = new CommandHandlerThread();

        rotWatcher.start();
        cmdHandler.start();

        try {
            rotWatcher.join();
            cmdHandler.join();

        } catch (InterruptedException e) {}

        Log.d(TAG, "Ending CommandServer");
    }
}
