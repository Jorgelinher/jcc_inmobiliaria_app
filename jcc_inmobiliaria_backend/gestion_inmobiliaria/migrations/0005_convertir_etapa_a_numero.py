# En el archivo de migración de datos generado
from django.db import migrations

def convertir_etapas(apps, schema_editor):
    Lote = apps.get_model('gestion_inmobiliaria', 'Lote')
    mapa_etapas = {
        'preventa': 1,
        'construccion': 2,
        'entrega_inmediata': 3,
        'otro': 4, # Define tu mapeo
    }
    for lote in Lote.objects.all():
        if isinstance(lote.etapa, str): # Si el campo etapa aún es el CharField
            lote.etapa_numerica = mapa_etapas.get(lote.etapa.lower())
            lote.save(update_fields=['etapa'])

class Migration(migrations.Migration):
    dependencies = [
        ('gestion_inmobiliaria', '0003_lote_etapa'), # La migración anterior
    ]
    operations = [
        migrations.RunPython(convertir_etapas),
    ]