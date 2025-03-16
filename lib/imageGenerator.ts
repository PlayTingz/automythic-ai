async function query(data) {
	const response = await fetch(
		"https://u44j9fs40qoxsnvq.us-east4.gcp.endpoints.huggingface.cloud",
		{
			headers: { 
				"Accept" : "image/png",
				"Authorization": "Bearer hf_XXXXX",
				"Content-Type": "application/json" 
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.blob();
	return result;
}

query({
    "inputs": "Astronaut riding a horse",
    "parameters": {}
}).then((response) => {
	// Use file
});
