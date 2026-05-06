from random import random
from django.shortcuts import render, redirect

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
import json


@csrf_exempt
@require_http_methods(["GET"])
@login_required
def filesFetch(request, projectID):
    """
    Fetch files for the authenticated user based on project_id
    """
    try:
        user = request.user

        # Get the file_store from user model
        file_store = user.file_store

        # If file_store is a dictionary with project_id as key
        if projectID in file_store:
            files = file_store[projectID]
            return JsonResponse(
                {
                    "success": True,
                    "project_id": projectID,
                    "files": files,
                    "message": "Files retrieved successfully",
                },
                status=200,
            )
        else:
            # Return empty list if project not found
            return JsonResponse(
                {
                    "success": True,
                    "project_id": projectID,
                    "files": [],
                    "message": "No files found for this project",
                },
                status=200,
            )

    except Exception as e:
        return JsonResponse(
            {"success": False, "message": f"Error fetching files: {str(e)}"}, status=500
        )


@csrf_exempt
@login_required
def getMainFile(request, projectID):
    """
    Fetch Main file name for the authenticated user based on project_id
    """
    try:
        user = request.user

        # Get the file_store from user model
        file_store = user.file_store

        # If file_store is a dictionary with project_id as key
        if projectID in file_store:
            main_file = file_store[projectID]["main_file"]
            return JsonResponse(
                {
                    "success": True,
                    "project_id": projectID,
                    "main_file": main_file,
                    "message": "Files retrieved successfully",
                },
                status=200,
            )
        else:
            # Return empty list if project not found
            return JsonResponse(
                {
                    "success": True,
                    "project_id": projectID,
                    "main_file": "main.typ",
                    "message": "No files found for this project",
                },
                status=200,
            )

    except Exception as e:
        return JsonResponse(
            {"success": False, "message": f"Error fetching files: {str(e)}"}, status=500
        )
    pass


from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
import json
from .models import User


# @require_http_methods(["POST"])
@csrf_exempt
@login_required
def filesChange(request):
    """
    Handle file changes for a project.

    Expected JSON body:
    {
        "ProjectID": [
            {"filename": "file1.txt", "newContent": "new content"},
            {"filename": "file2.txt", "newContent": "updated content"}
        ]
    }
    """

    # Parse JSON body
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)

    # Step 1: Verify the structure is correct

    try:
        if not isinstance(data, dict) or len(data) != 1:
            raise ValueError("Wrong WORNG WRONG WRONG")

        # Get the project ID and changes
        project_id = list(data.keys())[0]
        changes = data[project_id]

        # Verify project ID is a string
        if not isinstance(project_id, str) or not isinstance(changes, list):
            raise ValueError("Wrong WORNG WRONG WRONG")

        # Verify each change item has the correct structure
        for idx, change in enumerate(changes):
            if not (
                isinstance(change, dict)
                and isinstance(change.get("filename"), str)
                and isinstance(change.get("newContent"), str)
            ):
                raise ValueError("WRONG WRONG WRONG")
    except ValueError:
        return JsonResponse(
            {"error": f"NoNoNononOnonoNOONNOOOOOOO WRONG REQUEST"}, status=400
        )

    # Step 2: Verify the project ID exists in user's fileStore
    user = request.user
    file_store = user.file_store

    if project_id not in file_store:
        return JsonResponse(
            {"error": f'Project ID "{project_id}" not found in your file store'},
            status=404,
        )

    # Step 3: Update the associated files
    project_data = file_store[project_id]

    # Ensure the project has a 'files' dictionary
    if "files" not in project_data:
        project_data["files"] = {}

    # Apply all changes
    for change in changes:
        filename = change["filename"]
        new_content = change["newContent"]

        # Update or create the file in the project's files dictionary
        project_data["files"][filename] = new_content

        # If this file is the main_file, update that reference too
        if "main_file" in project_data and project_data["main_file"] == filename:
            # main_file reference remains the same, content already updated
            pass

    # Save the updated file_store back to the user
    user.file_store = file_store
    print(user.file_store)
    user.save()

    # Return success response
    return JsonResponse(
        {
            "status": "OK",
            "message": f"Successfully updated {len(changes)} file(s)",
            "updated_files": [change["filename"] for change in changes],
        },
        status=200,
    )


@csrf_exempt
@login_required
def filesList(request):
    try:
        user = request.user

        # Get the file_store from user model
        file_store = user.file_store
        # print("Type filestore", type(file_store["123"]), file_store)
        response = [
            (i, file_store.get(i).get("project_name", "Default ID")) for i in file_store
        ]
        print("response", response)

        # If file_store is a dictionary with project_id as key
        if response:

            return JsonResponse(
                {
                    "success": True,
                    "files": response,
                    "message": "Files retrieved successfully",
                },
                status=200,
            )
        else:
            # Return empty list if project not found
            return JsonResponse(
                {
                    "success": True,
                    # "project_id": projectID,
                    "files": [],
                    "message": "No files found for this project",
                },
                status=200,
            )

    except Exception as e:
        print(e)
        return JsonResponse(
            {"success": False, "message": f"Error fetching files: {str(e)}"}, status=500
        )


@csrf_exempt
@login_required
def createProject(request, project_name):
    try:
        import random

        hash = random.getrandbits(128)
        user = request.user
        file_store = user.file_store
        welcome_strings = ["HOIIHI", "BLEHH", "KONICHIWAAA", "ANNEYEONGHASEYOO"]
        file_store[str(hash)] = {
            "project_name": project_name,
            "main_file": "main.typ",
            "files": {"main.typ": random.choice(welcome_strings)},
        }
        user.file_store = file_store
        user.save()
        return JsonResponse(
            {
                "success": True,
                "message": f"Project '{project_name}' created successfully with ID {hash}",
                "project_id": str(hash),
            },
            status=201,
        )

    except Exception as e:
        pass
        # print(e)
        # return JsonResponse(
        #     {"success": False, "message": f"Error creating project_file: {str(e)}"}, status=500
        # )
