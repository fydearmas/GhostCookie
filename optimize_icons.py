from PIL import Image
import os

# Ruta de la nueva imagen
original = r"C:\Users\fydea\.gemini\antigravity\brain\9455d746-1cd1-4e42-b048-b97088f2ce52\uploaded_image_1765333046979.png"
output_dir = r"c:\Users\fydea\Documents\GitHub\plugin_browser\icons"

# Abrir imagen
img = Image.open(original)

# Convertir a RGBA si no lo es
if img.mode != 'RGBA':
    img = img.convert('RGBA')

# Obtener el bounding box del contenido (sin transparencia)
bbox = img.getbbox()

if bbox:
    # Recortar la imagen
    img_cropped = img.crop(bbox)
    
    # Añadir un padding muy pequeño (solo 5%)
    width, height = img_cropped.size
    padding = int(max(width, height) * 0.05)
    
    # Crear nueva imagen con padding mínimo
    new_size = max(width, height) + padding * 2
    img_padded = Image.new('RGBA', (new_size, new_size), (0, 0, 0, 0))
    
    # Centrar la imagen recortada
    x = (new_size - width) // 2
    y = (new_size - height) // 2
    img_padded.paste(img_cropped, (x, y))
    
    # Crear los diferentes tamaños
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        # Redimensionar con alta calidad
        img_resized = img_padded.resize((size, size), Image.Resampling.LANCZOS)
        
        # Guardar
        output_path = os.path.join(output_dir, f'icon{size}.png')
        img_resized.save(output_path, 'PNG', optimize=True)
        print(f'✓ Creado: icon{size}.png ({size}x{size})')
    
    print(f'\n✅ Iconos optimizados con padding mínimo (5%)')
    print(f'📏 Tamaño original: {img.size}')
    print(f'📏 Tamaño recortado: {img_cropped.size}')
    print(f'📏 Tamaño final: {new_size}x{new_size}')
else:
    print('❌ Error: No se pudo detectar el contenido de la imagen')
