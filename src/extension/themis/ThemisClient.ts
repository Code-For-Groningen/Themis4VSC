// We disable the naming convention rule because headers are usually CamelCase
/* eslint-disable @typescript-eslint/naming-convention */
import axios, { AxiosInstance } from 'axios';
import { Cookie, CookieJar } from 'tough-cookie';
import { AssignmentOptionGroup, Course, LoggedInUserInformation } from '../../protocol/protocol';
import { parse } from 'node-html-parser';
import { time } from 'console';
import { Extension, ExtensionContext } from 'vscode';

/**
 * This class is responsible for making requests to the Themis API.
 * It is responsible for storing cookies and other session data.
 */
class ThemisClient {
    private client: AxiosInstance;
    private cookieJar: CookieJar;
    private context: ExtensionContext;

    constructor(context: ExtensionContext) {
        this.cookieJar = new CookieJar();
        this.client = axios.create({
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "ro-RO,ro;q=0.9",
                "Cache-Control": "max-age=0",
                Connection: "keep-alive",
                "Content-Type": "application/x-www-form-urlencoded",
                DNT: "1",
                Host: "themis.housing.rug.nl",
                Origin: "https://themis.housing.rug.nl",
                Referer: "https://themis.housing.rug.nl/log/in",
                "sec-ch-ua": '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Linux"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/",
            }
        });
        this.context = context;
    }

    public getClient() {
        return this.client;
    }

    public checkLoggedInPage(response: string) {
        // Check if the login was successful
        // logged in as S[0-9]{7}, where [0-9]{7} is the student number, and we capture the student number
        let regexForLoggedIn = /logged in as ([sp][0-9]{7})/;

        let loggedIn = regexForLoggedIn.test(response);

        if (loggedIn) {
            // Extract the student number
            let studentNumber = regexForLoggedIn.exec(response)[1];

            // Extract the student name
            // <a href="/user" class="iconize user">M. Marziali</a>
            let studentName = response.split('<a href="/user" class="iconize user">')[1].split('</a>')[0];

            // Store the student number and name in the context
            return {
                name: studentName,
                studentId: studentNumber.toUpperCase()
            } as LoggedInUserInformation;
        }

        return null;
    }

    public async login(username: string, password: string) {
        const baseUrl = "https://themis.housing.rug.nl/log/in";
        let response = await this.client.get(baseUrl);
        let data = response.data;

        // Find the CSRF token [name='_csrf']
        let csrfToken = data.split('_csrf" value="')[1].split('"')[0];

        // Extract cookies
        for (let cookie of response.headers["set-cookie"]) {
            this.cookieJar.setCookieSync(Cookie.parse(cookie), baseUrl);
        }

        let requestPayload = {
            _csrf: csrfToken,
            user: username,
            password: password
        };

        let newResponse: string = await this.client.post(baseUrl, requestPayload, {
            headers: {
                Cookie: await this.cookieJar.getCookieString(baseUrl)
            }
        }).then(response => response.data).catch(error => error.response);

        return this.checkLoggedInPage(newResponse);
    }

    public async logout() {
        // https://themis.housing.rug.nl/log/out
        const baseUrl = "https://themis.housing.rug.nl/log/out";

        // Invalidate our session!
        let response = await this.client.get(baseUrl, { headers: { Cookie: await this.cookieJar.getCookieString(baseUrl) } });

        // Clear the cookie jar
        this.cookieJar = new CookieJar();

        return response.status === 200;
    }

    private async getCoursesAt(path: string, courseParent?: Course) {
        const baseUrl = "https://themis.housing.rug.nl/course";
        let response = await this.client.get(baseUrl + path, { headers: { Cookie: await this.cookieJar.getCookieString(baseUrl) } })
            .catch(error => {
                console.log(error);
                if (error.status === 418) {
                    // 418 I'm a teapot. What?
                    return undefined;
                } else {
                    return undefined;
                }
            });

        if (path.includes("2021"))
            console.log(response);

        if (response === undefined)
            return;

        let root = parse(response.data);
        let courses = root.querySelector("div.subsec.round.shade.ass-children > ul");

        if (courses === null) {
            return;
        }

        let promises = courses.querySelectorAll("a.ass-group").map(async (course, index) => {
            try {
                // Us being nice to the server
                await new Promise(resolve => setTimeout(resolve, index * 1000));
                let currentCourse = {
                    path: course.getAttribute("title"),
                    title: course.text,
                    courses: []
                };

                await this.getCoursesAt(course.getAttribute("title"), currentCourse);

                courseParent.courses = [
                    ...courseParent.courses,
                    currentCourse
                ];
            } catch (error) {
                console.log(error);
            }
        });

        for (let promise of promises) {
            await promise.catch(error => console.log(error));
        }

        console.log("Indexed " + courseParent.courses.length + " courses at " + courseParent.path);

        courseParent.courses = [
            ...courseParent.courses,
            ...courses.querySelectorAll("a.ass-submitable").map(course => {
                return {
                    path: course.getAttribute("title"),
                    title: course.text,
                    courses: []
                } as Course;
            })
        ];
    }

    public async indexCourses() {
        let courses = this.context.globalState.get("cachedCourses", undefined);

        if (courses !== undefined) {
            return courses;
        }

        let course = {
            path: "/",
            title: "Home",
            courses: []
        };
        await this.getCoursesAt("/", course);

        this.context.globalState.update("cachedCourses", course);

        return course;
    }

    public wipeCourseCache() {
        this.context.globalState.update("cachedCourses", undefined);
    }

    public async getAssignemnt(course: Course){
        let baseUrl = "https://themis.housing.rug.nl" + course.path;
        let response = await this.client.get(baseUrl, { headers: { Cookie: await this.cookieJar.getCookieString(baseUrl) } });

        let root = parse(response.data);

        // Start by parsing the configuration options
        let config = root.querySelectorAll(".ass-config")[0];

        let configOptions = [] as AssignmentOptionGroup[];
        let currentOptionGroup = {
            name: "Description",
            options: []
        } as AssignmentOptionGroup;
        
        for (let option of config.) {
            let parsedOption = parse(option.rawText);
            if(option.rawText.includes("cfg-line")){
                let title = parsedOption.querySelector(".tip");
            } else if(option.rawText.includes("cfg-group-title")){

            }
        }
    }
}

export default ThemisClient;