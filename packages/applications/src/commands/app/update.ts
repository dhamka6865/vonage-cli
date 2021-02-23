import Command from '../../helpers/base'
import { flags } from '@oclif/command'
import { prompt } from 'prompts'
import { webhookQuestions } from '../../helpers'
import { merge } from 'lodash';
import cli from 'cli-ux';
import chalk from 'chalk';

export default class ApplicationsUpdate extends Command {
    static description = 'Update Vonage application settings'

    static examples = []

    static flags = {
        ...Command.flags,
        'voice_answer_url': flags.string({
            description: 'Voice Answer Webhook URL Address',
            parse: input => `{"voice": {"webhooks": {"answer_url": {"address": "${input}"}}}}`
        }),
        'voice_answer_http': flags.string({
            description: 'Voice Answer Webhook HTTP Method',
            options: ['GET', 'POST'],
            dependsOn: ['voice_answer_url'],
            parse: input => `{"voice": {"webhooks": {"answer_url": {"method": "${input}"}}}}`
        }),
        'voice_event_url': flags.string({
            description: 'Voice Event Webhook URL Address',
            parse: input => `{"voice": {"webhooks": {"event_url": {"address": "${input}"}}}}`
        }),
        'voice_event_http': flags.string({
            description: 'Voice Event Webhook HTTP Method',
            options: ['GET', 'POST'],
            dependsOn: ['voice_event_url'],
            parse: input => `{"voice": {"webhooks": {"event_url": {"method": "${input}"}}}}`
        }),
        'messages_inbound_url': flags.string({
            description: 'Messages Inbound Webhook URL Address',
            parse: input => `{"messages": {"webhooks": {"inbound_url": {"address": "${input}"}}}}`
        }),
        'messages_status_url': flags.string({
            description: 'Messages Status Webhook URL Address',
            parse: input => `{"messages": {"webhooks": {"status_url": {"address": "${input}"}}}}`
        }),
        'rtc_event_url': flags.string({
            description: 'RTC Event Webhook URL Address',
            parse: input => `{"rtc": {"webhooks": {"event_url": {"address": "${input}"}}}}`
        }),
        'rtc_event_http': flags.string({
            description: 'RTC Event Webhook HTTP Method',
            options: ['GET', 'POST'],
            dependsOn: ['rtc_event_url'],
            parse: input => `{"rtc": {"webhooks": {"event_url": {"method": "${input}"}}}}`
        }),
        'vbc': flags.boolean({
            description: 'VBC Capabilities Enabled',
        }),

    }

    static args = [
        { name: 'appId', required: false },
    ]

    setQuestions(list: any) {
        return list.map((application: any) => {
            return {
                title: `${application.name} | ${application.id}`,
                value: application.id
            }
        })
    }

    // TODO - adding capabilities works, removing them currently not - needs to be addressed
    // due to the merge method - find a better way to do this.
    // TODO - make sure current data is getting passed for webhook questions

    async run() {
        const { args, flags }: { args: any, flags: { [index: string]: any } } = this.parse(ApplicationsUpdate)
        let response: any = { name: '', capabilities: {} };
        let app: any;

        // if no flags or arguments, use interactive mode
        if (!args.appId && Object.keys(flags).length === 0) {
            let appData = await this.allApplications;
            let appList = appData['_embedded'].applications;


            let init = await prompt([
                {
                    type: 'autocomplete',
                    name: 'appId',
                    message: 'Your Applications',
                    choices: this.setQuestions(appList),
                    initial: 0,
                }])

            app = await this.getSingleApplication(init.appId)
            let selected_capabilities = Object.keys(app.capabilities);

            let general = await prompt([
                {
                    type: 'text',
                    name: 'name',
                    message: `Application Name`,
                    initial: app.name
                },
                {
                    type: 'multiselect',
                    name: 'selected_capabilities',
                    message: 'Select App Capabilities',
                    choices: [
                        { title: 'Voice', value: 'voice', selected: !!app.capabilities['voice'] },
                        { title: 'Messages', value: 'messages', selected: !!app.capabilities['messages'] },
                        { title: 'RTC', value: 'rtc', selected: !!app.capabilities['rtc'] },
                        { title: 'VBC', value: 'vbc', selected: !!app.capabilities['vbc'] }
                    ],
                    hint: '- Space to select. Return to submit'
                }
            ])

            response = Object.assign({}, response, general);

            if (response.selected_capabilities?.indexOf('voice') > -1) {
                response.capabilities.voice = {}
                let answer_url, event_url

                let voice = await prompt({
                    type: 'confirm',
                    name: 'voice_webhooks_confirm',
                    message: 'Create voice webhooks?'
                })

                if (voice.voice_webhooks_confirm) {
                    answer_url = await webhookQuestions({ name: 'Answer Webhook', questions: 2 })
                    event_url = await webhookQuestions({ name: 'Event Webhook', questions: 2 })
                } else {
                    answer_url = { address: app.capabilities.voice.webhooks.answer_url.address || "https://www.sample.com/webhook/answer_url" }
                    event_url = { address: app.capabilities.voice.webhooks.event_url.address || "https://www.sample.com/webhook/event_url" }
                }

                response.capabilities.voice = { webhooks: { answer_url, event_url } }
            }

            if (response.selected_capabilities?.indexOf('messages') > -1) {
                response.capabilities.messages = {};
                let inbound_url, status_url
                let messages = await prompt({
                    type: 'confirm',
                    name: 'webhooks_confirm',
                    message: 'Create messages webhooks?'
                })

                if (messages.webhooks_confirm) {
                    inbound_url = await webhookQuestions({ name: 'Inbound Message Webhook', questions: 2 })
                    status_url = await webhookQuestions({ name: 'Status Webhook', questions: 2 })
                } else {
                    inbound_url = { address: app.capabilities.messages.webhooks.inbound_url.address || "https://www.sample.com/webhook/inbound_url" }
                    status_url = { address: app.capabilities.messages.webhooks.status_url.address || "https://www.sample.com/webhook/status_url" }
                }
                response.capabilities.messages = { webhooks: { status_url, inbound_url } }

            }

            if (response.selected_capabilities?.indexOf('rtc') > -1) {
                response.capabilities.rtc = {};
                let event_url

                let rtc = await prompt({
                    type: 'confirm',
                    name: 'webhooks_confirm',
                    message: 'Create RTC webhook?'
                })

                if (rtc.webhooks_confirm) {
                    let event_url = await webhookQuestions({ name: 'Event Webhook', questions: 2 })
                    response.capabilities.rtc = { webhooks: { event_url } }
                } else {
                    event_url = { address: app.capabilities.rtc.webhooks.event_url.address || "https://www.sample.com/webhook/rtc_event_url" }
                }

                response.capabilities.rtc = { webhooks: { event_url } }
            }

            if (response.selected_capabilities?.indexOf('vbc') > -1) {
                response.capabilities.vbc = {}
            }

            delete response.selected_capabilities

        }


        // if flags are provided but no appId, throw error
        if (!args.appId && Object.keys(flags).length > 0) {
            this.error("Missing Required Argument: name")
        }
        // if name is provided, just create the application.
        // the SDK can verify the response
        if (args.name && Object.keys(flags).length >= 0) {

            let tobeAssigned = Object.keys(flags).map((value: string, index) => {
                return JSON.parse(flags[value])
            }, [])

            merge(response.capabilities, ...tobeAssigned)
            response.name = args.name;
        }

        // go back and just build new object to send to method
        await this.updateApplication(merge({}, app, response))
        // handle SDK error responses
        cli.action.start(chalk.bold('Updating Application'), 'Initializing', { stdout: true })
        let output = await this.createApplication(response)
        this.log(chalk.bold("Application ID:"), output.id)
        this.log(chalk.bold("Application Name:"), output.name)
        this.log(chalk.bold("Capabilities"), Object.keys(output.capabilities))
        cli.action.stop()
        // handle successful creation
    }

}
