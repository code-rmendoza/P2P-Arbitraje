from django.db import migrations, models


def dedupe_wallets(apps, schema_editor):
    Wallet = apps.get_model('calculator', 'Wallet')
    Transaction = apps.get_model('calculator', 'Transaction')

    groups = {}
    for wallet in Wallet.objects.order_by('id'):
        key = (
            wallet.name.strip().lower(),
            wallet.platform.strip().lower(),
            wallet.currency,
        )
        groups.setdefault(key, []).append(wallet)

    for wallets in groups.values():
        if len(wallets) <= 1:
            continue

        keeper = wallets[0]
        for duplicate in wallets[1:]:
            Transaction.objects.filter(wallet_from_id=duplicate.id).update(wallet_from_id=keeper.id)
            Transaction.objects.filter(wallet_to_id=duplicate.id).update(wallet_to_id=keeper.id)

            if keeper.balance == 0 and duplicate.balance != 0:
                keeper.balance = duplicate.balance
            if keeper.opening_balance == 0 and duplicate.opening_balance != 0:
                keeper.opening_balance = duplicate.opening_balance
            keeper.is_active = keeper.is_active or duplicate.is_active
            keeper.save()

            duplicate.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('calculator', '0005_wallet_opening_balance'),
    ]

    operations = [
        migrations.RunPython(dedupe_wallets, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='wallet',
            constraint=models.UniqueConstraint(
                fields=('name', 'platform', 'currency'),
                name='unique_wallet_identity'
            ),
        ),
    ]
