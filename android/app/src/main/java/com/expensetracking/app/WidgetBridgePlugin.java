package com.expensetracking.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app push the balance text to the home-screen widget. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void setBalance(PluginCall call) {
        String label = call.getString("label", "");
        String balance = call.getString("balance", "");
        Context ctx = getContext();
        BalanceWidgetProvider.save(ctx, label, balance);
        BalanceWidgetProvider.refreshAll(ctx);
        call.resolve(new JSObject());
    }
}
