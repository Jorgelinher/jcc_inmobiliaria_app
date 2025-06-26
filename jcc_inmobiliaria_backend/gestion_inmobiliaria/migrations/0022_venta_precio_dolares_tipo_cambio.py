from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('gestion_inmobiliaria', '0021_presencia_tipo_tour'),
    ]
    operations = [
        migrations.AddField(
            model_name='venta',
            name='precio_dolares',
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name='Precio Venta ($)'),
        ),
        migrations.AddField(
            model_name='venta',
            name='tipo_cambio',
            field=models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name='Tipo de Cambio (S/ por $)'),
        ),
    ] 