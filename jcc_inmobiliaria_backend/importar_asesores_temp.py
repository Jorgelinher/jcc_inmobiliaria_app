import csv
from datetime import datetime
from gestion_inmobiliaria.models import Asesor
from django.utils.dateparse import parse_date

print("=== INICIANDO IMPORTACIÓN DE ASESORES ===")
try:
    with open('asesores_import.csv', encoding='latin-1') as f:
        r = csv.DictReader(f, delimiter=';')
        creados = 0
        actualizados = 0
        for row in r:
            nombre = row.get('NOMBRE', '').strip()
            dni = row.get('DNI', '').strip() or None
            fecha_nacimiento = row.get('FECHA_NACIMIENTO', '').strip()
            estado_civil = row.get('ESTADO_CIVIL', '').strip() or None
            numero_hijos = row.get('NUMERO_HIJOS', '').strip()
            direccion = row.get('DIRECCION', '').strip() or None
            distrito = row.get('DISTRITO', '').strip() or None
            telefono = row.get('TELEFONO', '').strip() or None
            email = row.get('EMAIL', '').strip() or None
            banco = row.get('BANCO', '').strip() or None
            cuenta_bancaria = row.get('CUENTA_BANCARIA', '').strip() or None
            cci = row.get('CCI', '').strip() or None
            fecha_ingreso = row.get('FECHA_INGRESO', '').strip()
            tipo = row.get('TIPO', '').strip() or 'Junior'
            fecha_cambio_socio = row.get('FECHA_CAMBIO_SOCIO', '').strip()
            observaciones = row.get('OBSERVACIONES', '').strip() or None

            # Parsear fechas
            fecha_nacimiento_dt = None
            if fecha_nacimiento:
                try:
                    fecha_nacimiento_dt = datetime.strptime(fecha_nacimiento, '%d/%m/%Y').date()
                except Exception:
                    fecha_nacimiento_dt = parse_date(fecha_nacimiento)
            fecha_ingreso_dt = None
            if fecha_ingreso:
                try:
                    fecha_ingreso_dt = datetime.strptime(fecha_ingreso, '%d/%m/%Y').date()
                except Exception:
                    fecha_ingreso_dt = parse_date(fecha_ingreso)
            fecha_cambio_socio_dt = None
            if fecha_cambio_socio:
                try:
                    fecha_cambio_socio_dt = datetime.strptime(fecha_cambio_socio, '%d/%m/%Y').date()
                except Exception:
                    fecha_cambio_socio_dt = parse_date(fecha_cambio_socio)
            try:
                asesor = None
                if dni:
                    asesor = Asesor.objects.filter(dni=dni).first()
                if asesor:
                    asesor.nombre_asesor = nombre
                    asesor.fecha_nacimiento = fecha_nacimiento_dt
                    asesor.estado_civil = estado_civil
                    asesor.numero_hijos = int(numero_hijos) if numero_hijos.isdigit() else 0
                    asesor.direccion = direccion
                    asesor.distrito = distrito
                    asesor.telefono_personal = telefono
                    asesor.email_personal = email
                    asesor.banco = banco
                    asesor.numero_cuenta_bancaria = cuenta_bancaria
                    asesor.cci_cuenta_bancaria = cci
                    asesor.fecha_ingreso = fecha_ingreso_dt
                    asesor.fecha_cambio_socio = fecha_cambio_socio_dt
                    asesor.observaciones_asesor = observaciones
                    asesor.save()
                    actualizados += 1
                else:
                    Asesor.objects.create(
                        nombre_asesor=nombre,
                        dni=dni,
                        fecha_nacimiento=fecha_nacimiento_dt,
                        estado_civil=estado_civil,
                        numero_hijos=int(numero_hijos) if numero_hijos.isdigit() else 0,
                        direccion=direccion,
                        distrito=distrito,
                        telefono_personal=telefono,
                        email_personal=email,
                        banco=banco,
                        numero_cuenta_bancaria=cuenta_bancaria,
                        cci_cuenta_bancaria=cci,
                        fecha_ingreso=fecha_ingreso_dt,
                        fecha_cambio_socio=fecha_cambio_socio_dt,
                        observaciones_asesor=observaciones
                    )
                    creados += 1
            except Exception as e:
                print(f'Error en fila: {row} -> {e}')
        print(f'Asesores creados: {creados}, actualizados: {actualizados}')
except Exception as e:
    print(f'Error al importar asesores: {e}')
print("=== FINALIZÓ IMPORTACIÓN DE ASESORES ===")

if __name__ == '__main__':
    importar_asesores() 