import io
import json
from datetime import datetime, date

from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum
from django.template.loader import get_template

from xhtml2pdf import pisa
from .models import Mark

# --- Helper Functions ---

def calculate_age(dob):
    #Calculates the age based on the date of birth.
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def _get_mark_data(mark_obj):
    #Helper to serialize a single Mark object into a dictionary.
    return {
        'id': mark_obj.id,
        'name': mark_obj.name,
        'dob': str(mark_obj.dob),
        'date': str(mark_obj.date),
        'subject': mark_obj.subject,
        'marks': mark_obj.marks,
        'outOf': mark_obj.out_of,
        'percentage': round(mark_obj.percentage, 2),
        'result': mark_obj.result,
        'r_status': mark_obj.r_status,
    }

#Validation Functions
def validate_and_clean(data, is_update=False, existing_mark_id=None):

    name = (data.get('name') or '').strip()
    subject = (data.get('subject') or '').strip()
    dob_str = data.get('dob')
    date_str = data.get('date')
    marks_val = data.get('marks')
    out_of_val = data.get('outOf')

    if not is_update:
        if not all([name, subject, dob_str, date_str, marks_val is not None, out_of_val is not None]):
            return False, JsonResponse({'error': 'Missing required fields.'}, status=400)
    else:
        pass

    if marks_val is not None:
        try:
            marks_val = float(marks_val)
        except ValueError:
            return False, JsonResponse({'error': 'Marks must be a valid number.'}, status=400)
    
    if out_of_val is not None:
        try:
            out_of_val = float(out_of_val)
        except ValueError:
            return False, JsonResponse({'error': 'Out Of must be a valid number.'}, status=400)

    if marks_val is not None and out_of_val is not None:
        if marks_val > out_of_val:
            return False, JsonResponse({'error': 'Marks cannot be greater than Out Of marks.'}, status=400)
    elif is_update: 
        pass

    # Validate DOB format and age
    if dob_str is not None:
        try:
            birth_date = datetime.strptime(dob_str, '%Y-%m-%d').date()
            if calculate_age(birth_date) < 15:
                return False, JsonResponse({'error': 'Student must be at least 15 years old.'}, status=400)
        except ValueError:
            return False, JsonResponse({'error': 'Invalid date format for DOB. Use YYYY-MM-DD.'}, status=400)
    
    # Validate Exam Date format
    if date_str is not None:
        try:
            datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return False, JsonResponse({'error': 'Invalid date format for Exam Date. Use YYYY-MM-DD.'}, status=400)

    cleaned_data = {
        'cleaned_name': name,
        'cleaned_subject': subject,
        'cleaned_dob': dob_str,
        'cleaned_date': date_str,
        'cleaned_marks': marks_val,
        'cleaned_out_of': out_of_val,
    }
    return True, cleaned_data

# --- Core Views ---

def index(request):
    return render(request, 'marks/index.html')
    

@csrf_exempt
def manage_marks(request):

    if request.method == 'GET':
        mark_objects = Mark.objects.all().order_by('name', 'subject')
        marks_data = [_get_mark_data(mark_obj) for mark_obj in mark_objects]
        return JsonResponse(marks_data, safe=False)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            is_valid, validation_result = validate_and_clean(data, is_update=False)
            if not is_valid:
                return validation_result

            # Unpack cleaned data
            name = validation_result['cleaned_name']
            subject = validation_result['cleaned_subject']
            dob_str = validation_result['cleaned_dob']
            date_str = validation_result['cleaned_date']
            marks_val = validation_result['cleaned_marks']
            out_of_val = validation_result['cleaned_out_of']

            # Check for existing entry for the same student and subject
            if Mark.objects.filter(name=name, subject=subject).exists():
                print(f"Adding new mark for {name} in {subject}")
                return JsonResponse({'error': f'Student "{name}" already has an entry for "{subject}".'}, status=400)
            

            # Check maximum subjects per student
            if Mark.objects.filter(name=name).count() >= 5:
                return JsonResponse({'error': f'Student "{name}" already has 5 subjects recorded. Cannot add more.'}, status=400)

            # --- Create Mark ---
            mark = Mark.objects.create(name=name,dob=dob_str,date=date_str,subject=subject,marks=marks_val,out_of=out_of_val)
            return JsonResponse(_get_mark_data(mark), status=201)

        except Exception as e:
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)

    elif request.method == 'PUT':
        try:
            data = json.loads(request.body)
            mark_id = data.get('id')

            if not mark_id:
                return JsonResponse({'error': 'Mark ID is required for update.'}, status=400)

            try:
                mark = Mark.objects.get(id=mark_id)
            except Mark.DoesNotExist:
                return JsonResponse({'error': 'Mark not found.'}, status=404)

            # Store original values for comparison
            
            original_name = mark.name
            original_subject = mark.subject

            is_valid, validation_result = validate_and_clean(data, is_update=True, existing_mark_id=mark_id)

            if not is_valid:
                return validation_result 

            if 'name' in data:
                mark.name = validation_result['cleaned_name']
            if 'subject' in data:
                mark.subject = validation_result['cleaned_subject']
            if 'dob' in data:
                mark.dob = datetime.strptime(validation_result['cleaned_dob'], '%Y-%m-%d').date()
            if 'date' in data:
                mark.date = datetime.strptime(validation_result['cleaned_date'], '%Y-%m-%d').date()
            if 'marks' in data:
                mark.marks = validation_result['cleaned_marks']
            if 'outOf' in data:
                mark.out_of = validation_result['cleaned_out_of']
                
            # Check for duplicate name-subject combination if name or subject changed
            if (mark.name != original_name or mark.subject != original_subject):
                if Mark.objects.filter(name=mark.name, subject=mark.subject).exclude(id=mark_id).exists():
                    return JsonResponse({'error': f'Another entry exists for student "{mark.name}" and subject "{mark.subject}".'}, status=400)
                
            if calculate_age(mark.dob) < 15:
                return JsonResponse({'error': 'Student must be at least 15 years old.'}, status=400)
            
            if mark.marks > mark.out_of:
                return JsonResponse({'error': 'Marks cannot be greater than Out Of marks.'}, status=400)

            mark.save()
            return JsonResponse(_get_mark_data(mark))
            
        except ValueError as e:
            return JsonResponse({'error': f'Invalid data type or format: {e}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)

    elif request.method == 'DELETE':
        try:
            data = json.loads(request.body)
            mark_id = data.get('id')
            if not mark_id:
                return JsonResponse({'error': 'Mark ID is required for deletion.'}, status=400)

            mark = get_object_or_404(Mark, id=mark_id)
            mark.delete()
            return JsonResponse({'message': 'Mark deleted successfully.'})
        
        except get_object_or_404: 
            return JsonResponse({'error': 'Mark not found.'}, status=404)

        except Exception as e:
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)

    return JsonResponse({'error': 'Method not allowed.'}, status=405)

@csrf_exempt
def update_R_status(request): 
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method allowed."}, status=405)

    try:
        data = json.loads(request.body)
        ids = data.get("ids")
        new_status = data.get("newStatus")

        # Validate IDs
        if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
            return JsonResponse({"error": "'ids' must be a list of integers."}, status=400)

        # Validate newStatus
        valid_statuses = [choice[0] for choice in Mark._meta.get_field('r_status').choices]
        if new_status not in valid_statuses:
            return JsonResponse({"error": f"'newStatus' must be one of {valid_statuses}."}, status=400)

        # Perform update
        updated_count = Mark.objects.filter(id__in=ids).update(r_status=new_status)
        return JsonResponse({"success": True, "updated_count": updated_count})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def reset_status(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method allowed."}, status=405)

    try:
        data = json.loads(request.body)
        mark_id = data.get("id")

        if not isinstance(mark_id, int):
            return JsonResponse({"error": "Invalid or missing 'id'. Must be an integer."}, status=400)

        updated_count = Mark.objects.filter(id=mark_id, r_status__in=['pass', 'fail']).update(r_status='pending')

        if updated_count == 0:
            return JsonResponse({"message": "No matching entry found or already pending."}, status=404)

        return JsonResponse({"success": True, "message": f"Status for ID {mark_id} reset to 'pending'."})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body.'}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Unexpected error: {str(e)}"}, status=500)


def scorecard(request, name):
    marks = Mark.objects.filter(name=name).order_by('date')
    if not marks.exists():
        return HttpResponse("No marks found for this student.", status=404)

    student = marks.first()
    aggregates = marks.aggregate(total_obtained=Sum('marks'), total_possible=Sum('out_of'))
    total_obtained = aggregates.get('total_obtained') or 0
    total_possible = aggregates.get('total_possible') or 0
    overall_percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    overall_status = "PASS" if all(mark.result == "Pass" for mark in marks) else "FAIL"

    # Check for PDF mode
    pdf_mode = request.GET.get('pdf', 'false').lower() == 'true'

    context = {
        'student_name': student.name,
        'student_id': student.id,
        'date_of_birth': student.dob,
        'status': overall_status,
        'marks': marks,
        'total_obtained_marks': total_obtained,
        'total_possible_marks': total_possible,
        'overall_percentage': overall_percentage,
        'pdf_mode': pdf_mode
    }

    if pdf_mode:
        template_path = 'marks/scorecard_pdf.html'
        template = get_template(template_path)
        html = template.render(context)
        result = io.BytesIO()
        pdf = pisa.CreatePDF(html, dest=result)
        if not pdf.err:
            response = HttpResponse(result.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{name}_scorecard.pdf"'
            return response
        return HttpResponse(f'PDF generation error: <pre>{html}</pre>', status=500)

    return render(request, 'marks/scorecard_pdf.html', context)
