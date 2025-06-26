from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('gestion_inmobiliaria', '0022_venta_precio_dolares_tipo_cambio'),
    ]
    operations = [
        migrations.AddField(
            model_name='lote',
            name='precio_credito_12_meses_dolares',
            field=models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Precio Crédito 12 Meses ($)'),
        ),
        migrations.AddField(
            model_name='lote',
            name='precio_credito_24_meses_dolares',
            field=models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Precio Crédito 24 Meses ($)'),
        ),
        migrations.AddField(
            model_name='lote',
            name='precio_credito_36_meses_dolares',
            field=models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Precio Crédito 36 Meses ($)'),
        ),
    ] 