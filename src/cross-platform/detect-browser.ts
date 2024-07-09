export function checkIfFirefox(): Promise<boolean> {
    return new Promise((resolve) => {
        try{
        if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
            resolve(true);
        } else {
            resolve(false);
        }
        } catch (error) {
            resolve(false);
        }
    })
}