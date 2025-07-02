import csv
from gestion_inmobiliaria.models import Cliente
from django.utils.dateparse import parse_date

def importar_clientes():
    with open('clientes_import.csv', encoding='latin-1') as f:
        r = csv.DictReader(f, delimiter=';')
        creados = 0
        actualizados = 0
        for row in r:
            nombre = row.get('NOMBRES', '').strip()
            tipo_documento = row.get('TIPO_DOCUMENTO', '').strip()
            distrito = row.get('DISTRITO', '').strip()
            telefono_principal = row.get('TELEFONO_PRINCIPAL', '').strip()
            # Opcionales
            numero_documento = row.get('NUMERO_DOCUMENTO', '').strip() or None
            fecha_nacimiento = row.get('FECHA_NACIMIENTO', '').strip()
            direccion = row.get('DIRECCION', '').strip()
            provincia = row.get('PROVINCIA', '').strip()
            departamento = row.get('DEPARTAMENTO', '').strip()
            telefono_secundario = row.get('TELEFONO_SECUNDARIO', '').strip()
            email_principal = row.get('EMAIL_PRINCIPAL', '').strip()
            email_secundario = row.get('EMAIL_SECUNDARIO', '').strip()
            estado_civil = row.get('ESTADO_CIVIL', '').strip()
            profesion = row.get('PROFESION', '').strip()

            if not nombre:
                print('Fila ignorada por falta de nombre:', row)
                continue

            cliente = Cliente.objects.filter(nombres_completos_razon_social=nombre).first()
            if cliente:
                # Actualizar datos básicos si ya existe
                cliente.tipo_documento = tipo_documento
                cliente.distrito = distrito
                cliente.telefono_principal = telefono_principal
                cliente.numero_documento = numero_documento
                cliente.fecha_nacimiento_constitucion = parse_date(fecha_nacimiento) if fecha_nacimiento else None
                cliente.direccion = direccion
                cliente.provincia = provincia
                cliente.departamento = departamento
                cliente.telefono_secundario = telefono_secundario
                cliente.email_principal = email_principal
                cliente.email_secundario = email_secundario
                cliente.estado_civil = estado_civil
                cliente.profesion_ocupacion = profesion
                cliente.save()
                actualizados += 1
            else:
                Cliente.objects.create(
                    nombres_completos_razon_social=nombre,
                    tipo_documento=tipo_documento,
                    distrito=distrito,
                    telefono_principal=telefono_principal,
                    numero_documento=numero_documento,
                    fecha_nacimiento_constitucion=parse_date(fecha_nacimiento) if fecha_nacimiento else None,
                    direccion=direccion,
                    provincia=provincia,
                    departamento=departamento,
                    telefono_secundario=telefono_secundario,
                    email_principal=email_principal,
                    email_secundario=email_secundario,
                    estado_civil=estado_civil,
                    profesion_ocupacion=profesion
                )
                creados += 1
        print(f'Clientes creados: {creados}, actualizados: {actualizados}')

if __name__ == '__main__':
    importar_clientes() 