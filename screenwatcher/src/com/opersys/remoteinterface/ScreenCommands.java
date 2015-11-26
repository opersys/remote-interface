package com.opersys.remoteinterface;

import android.content.Context;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.util.Log;
import android.view.IRotationWatcher;
import android.view.IWindowManager;
import android.view.Surface;

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
public class ScreenCommands {

    private static String TAG = "RI.ScreenCommands";

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
        private static String TAG = "RI.ScreenCommands.CommandHandlerThread";

        private BufferedReader br;
        private IWindowManager wm;

        public void run() {
            try {
                while (true) {
                    String cmd, c;
                    StringTokenizer st;

                    cmd = br.readLine();
                    st = new StringTokenizer(cmd);
                    c = st.nextToken(" ");

                    // Rotate command.
                    if ("rotate".equals(c)) {
                        int crot, rot = Surface.ROTATION_0;

                        crot = Integer.parseInt(st.nextToken(" "));

                        //
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
            br = new BufferedReader(new InputStreamReader(System.in));
            wm = IWindowManager.Stub.asInterface(ServiceManager.getService(Context.WINDOW_SERVICE));
        }
    }

    private static class RotationWatcherThread extends Thread {
        private static String TAG = "RI.ScreenCommands.RotationWatcherThread";

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

        Log.d(TAG, "Starting ScreenCommands");

        rotWatcher = new RotationWatcherThread();
        cmdHandler = new CommandHandlerThread();

        rotWatcher.start();
        cmdHandler.start();

        try {
            rotWatcher.join();
            cmdHandler.join();

        } catch (InterruptedException e) {}

        Log.d(TAG, "Ending ScreenCommands");
    }
}
