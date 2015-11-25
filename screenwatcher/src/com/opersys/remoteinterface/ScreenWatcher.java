package com.opersys.remoteinterface;

import android.content.Context;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.view.IRotationWatcher;
import android.view.IWindowManager;
import android.view.Surface;

/**
 * Tiny console program that sits around and receive notification from the window manager when
 * the device is rotated.
 *
 * https://github.com/openstf/STFService.apk/blob/master/app/src/main/java/jp/co/cyberagent/stf/monitor/RotationMonitor.java
 */
public class ScreenWatcher extends Thread {

    IRotationWatcher watcher = new IRotationWatcher.Stub() {
        @Override
        public void onRotationChanged(int rotation) throws RemoteException {
            System.out.println(rotationToDegrees(rotation));
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

    public ScreenWatcher() {
        IWindowManager wm = null;

        try {
            wm = IWindowManager.Stub.asInterface(ServiceManager.getService(Context.WINDOW_SERVICE));
            wm.watchRotation(watcher);

            synchronized (this) {
                while (!isInterrupted()) {
                    wait();
                }
            }
        } catch (RemoteException e) {
            e.printStackTrace(System.err);
        } catch (InterruptedException e) {
            e.printStackTrace(System.err);
        }
    }

    public static void main(String args[]) {
        new ScreenWatcher();
    }
}
