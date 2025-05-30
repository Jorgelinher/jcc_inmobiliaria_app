from django.http import HttpResponse

def index_view(request):
    html_content = """
    <html>
        <head><title>JCC Inmobiliaria API</title></head>
        <body>
            <h1>Bienvenido al Backend del Sistema Inmobiliario JCC</h1>
            <p>Este es el backend de la aplicación. La interfaz de usuario principal se desarrollará por separado (Frontend).</p>
            <p>Enlaces útiles:</p>
            <ul>
                <li><a href="/admin/">Panel de Administración de Django</a></li>
                <li><a href="/api/gestion/lotes/">API: Lotes</a></li>
                <li><a href="/api/gestion/clientes/">API: Clientes</a></li>
                <li><a href="/api/gestion/asesores/">API: Asesores</a></li>
                <li><a href="/api/gestion/ventas/">API: Ventas</a></li>
                <li><a href="/api/gestion/actividades/">API: Actividades</a></li>

            </ul>
        </body>
    </html>
    """
    return HttpResponse(html_content)