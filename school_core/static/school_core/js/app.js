// school_core/static/school_core/app.js
async function loadView(viewName, param = null) {
    const container = document.getElementById('app-container');

    // 1. Fetch the HTML component
    const templateResponse = await fetch(`/static/school_core/components/${viewName}.html`);
    const templateHtml = await templateResponse.text();

    // 2. Fetch the SQL Data from your new API
    let apiUrl = `/api/school/?type=${viewName}`;
    if (param) apiUrl += `&id=${param}`;

    const dataResponse = await fetch(apiUrl);
    const result = await dataResponse.json();

    // 3. Inject into the page
    container.innerHTML = templateHtml;

    // 4. Run a local "Init" function for that specific view
    if (viewName === 'course_dashboard') initCourseDashboard(result.data);
}