# Generated manually for portfolio profit baseline.

from django.db import migrations, models


def copy_balance_to_opening_balance(apps, schema_editor):
    Wallet = apps.get_model('calculator', 'Wallet')
    for wallet in Wallet.objects.all():
        wallet.opening_balance = wallet.balance
        wallet.save(update_fields=['opening_balance'])


class Migration(migrations.Migration):

    dependencies = [
        ('calculator', '0004_wallet_transaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='wallet',
            name='opening_balance',
            field=models.FloatField(default=0.0),
        ),
        migrations.RunPython(copy_balance_to_opening_balance, migrations.RunPython.noop),
    ]
