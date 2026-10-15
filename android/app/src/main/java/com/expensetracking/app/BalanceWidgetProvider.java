package com.expensetracking.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class BalanceWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "next_expenses_widget";

    static void save(Context ctx, String label, String balance) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("label", label).putString("balance", balance).apply();
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, BalanceWidgetProvider.class));
        for (int id : ids) update(ctx, mgr, id);
    }

    static void update(Context ctx, AppWidgetManager mgr, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String label = p.getString("label", ctx.getString(R.string.widget_default_label));
        String balance = p.getString("balance", "—");

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_balance);
        v.setTextViewText(R.id.widget_label, label);
        v.setTextViewText(R.id.widget_balance, balance);

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root,
            PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        Intent quick = new Intent(Intent.ACTION_VIEW, Uri.parse("com.expensetracking.app://quick-add"));
        quick.setPackage(ctx.getPackageName());
        quick.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_quick_add,
            PendingIntent.getActivity(ctx, 2, quick, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(id, v);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) update(ctx, mgr, id);
    }
}
