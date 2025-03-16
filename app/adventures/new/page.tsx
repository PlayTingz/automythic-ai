'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { adventureData } from './adventureData'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { env } from '@/lib/env'

export default function NewAdventure() {
  const [formData, setFormData] = useState({
    name: '',
    theme: '',
    goal: '',
    characters: [] as string[],
    tone: '',
    choices: [] as string[],
    endings: [] as string[],
    customCharacters: '',
    customEndings: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSelectChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleCheckboxChange = (
    field: string,
    value: string,
    checked: boolean
  ) => {
    const updatedArray = checked
      ? [...formData[field as keyof typeof formData], value]
      : (formData[field as keyof typeof formData] as string[]).filter(
        (v) => v !== value
      )
    setFormData({ ...formData, [field]: updatedArray })
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const google = createGoogleGenerativeAI({
    // custom settings
    apiKey: env.NEXT_PUBLIC_GOOGLE_API_KEY,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.theme || !formData.goal) {
      toast('Error', {
        description: 'Please fill in the name, theme, and goal.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const adventureSlug = formData.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

      const adventurePrompt = `
  Create a text-based adventure game with the title "${formData.name}" in the ${formData.theme
        } genre, Tone/Difficulty: "${formData.tone || 'moderate'}", Main Goal: "${formData.goal
        }", Endings: "${formData.endings.join(', ') || 'victory, failure'}${formData.customEndings ? ', ' + formData.customEndings : ''
        }".
      
  Based on this user prompt: "${prompt}", 
  
  Format your response as a JSON object with the following structure:
  {
    "title": "The adventure title",
    "initialScene": "intro",
    "characters": {
      "narrator": {
        "id": "narrator",
        "name": "Narrator",
        "image": "/game-images/narrator.jpg"
      },
      // Add other characters as needed
    },
    "scenes": {
      "intro": {
        "id": "intro",
        "narration": "A compelling introduction to the adventure setting and premise (about 2-3 paragraphs)",
        "background": "URL to an image representing the scene",
        "characters": ["narrator", "character1", "character2"],
        "dialogues": [
          {
            "characterId": "character1",
            "text": "Dialogue text for character1"
          },
          {
            "characterId": "character2",
            "text": "Dialogue text for character2"
          }
        ],
        "choices": [
          {
            "id": "choice1",
            "text": "First choice description",
            "nextSceneId": "scene1"
          },
          {
            "id": "choice2",
            "text": "Second choice description",
            "nextSceneId": "scene2"
          }
        ]
      },
      "scene1": {
        "id": "scene1",
        "narration": "Description of what happens after the first choice",
        "background": "URL to an image representing the scene",
        "characters": ["narrator", "character1"],
        "dialogues": [
          {
            "characterId": "character1",
            "text": "Dialogue text for character1"
          }
        ],
        "choices": [
          {
            "id": "choice1_1",
            "text": "Option 1",
            "nextSceneId": "scene1_1"
          },
          {
            "id": "choice1_2",
            "text": "Option 2",
            "nextSceneId": "scene1_2"
          }
        ]
      },
      // Add more scenes as needed
    }
  }
  
  Create at least 10 different scenes with meaningful choices that branch the story in different directions.
  Some scenes should be endings (success or failure) - these won't have choices.
  Make the adventure engaging, descriptive, and appropriate for the selected theme.
`
      // Generate game data with Vercel AI SDK
      const { text } = await generateText({
        model: google('gemini-1.5-pro-latest'),
        prompt: adventurePrompt,
      })

      console.log(text)

      // Parse the AI response (assuming it returns a stringified GameData)

      let gameData
      try {
        // Extract JSON from the response (in case the AI includes extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          gameData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No valid JSON found in the response')
        }
      } catch (error) {
        console.error('Failed to parse AI response:', error)
        throw new Error('Failed to generate a valid adventure structure')
      }

      // Send to API for storage
      const res = await fetch('/api/adventures', {
        method: 'POST',
        body: JSON.stringify({ slug: adventureSlug, gameData }),
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) throw new Error('Failed to create adventure')

      const { slug } = await res.json()
      toast('Success', { description: 'Your adventure has been created!' })
      router.push(`/adventures/${slug}`)

      // const finalFormData = {
      //   ...formData,
      //   characters: formData.customCharacters
      //     ? [...formData.characters, formData.customCharacters]
      //     : formData.characters,
      //   endings: formData.customEndings
      //     ? [...formData.endings, formData.customEndings]
      //     : formData.endings,
      //   slug: adventureSlug,
      // }

      // const res = await fetch('/api/adventures', {
      //   method: 'POST',
      //   body: JSON.stringify(finalFormData),
      //   headers: { 'Content-Type': 'application/json' },
      // })

      // if (!res.ok) throw new Error('Failed to create adventure')

      // const { slug } = await res.json()
      // toast('Success', {
      //   description: 'Your adventure has been created!',
      // })
      // router.push(`/adventures/${slug}`)
    } catch (error) {
      console.error(error)
      toast('Error', {
        description: 'Something went wrong. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">
            Create a New Adventure
          </CardTitle>
          <CardDescription className="text-gray-400">
            Pick options or add your own to craft a story fast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Adventure Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Adventure Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Haunted Hollow"
                className="bg-gray-800 border-gray-700 text-white"
                disabled={isSubmitting}
              />
            </div>

            {/* Theme/Setting */}
            <div className="space-y-2">
              <Label htmlFor="theme" className="text-white">
                Theme or Setting <span className="text-red-400">*</span>
              </Label>
              <Select
                onValueChange={(value) => handleSelectChange('theme', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choose a theme" />
                </SelectTrigger>
                <SelectContent>
                  {adventureData.themes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Main Goal */}
            <div className="space-y-2">
              <Label htmlFor="goal" className="text-white">
                Main Goal <span className="text-red-400">*</span>
              </Label>
              <Select
                onValueChange={(value) => handleSelectChange('goal', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choose a goal" />
                </SelectTrigger>
                <SelectContent>
                  {adventureData.goals.map((goal) => (
                    <SelectItem key={goal.value} value={goal.value}>
                      {goal.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Key Characters */}
            {/* <div className="space-y-2">
              <Label className="text-white">Key Characters (Pick any)</Label>
              <div className="space-y-2">
                {adventureData.characters.map((char) => (
                  <div key={char} className="flex items-center space-x-2">
                    <Checkbox
                      id={char}
                      checked={formData.characters.includes(char)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange(
                          'characters',
                          char,
                          checked as boolean
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={char} className="text-gray-300">
                      {char}
                    </Label>
                  </div>
                ))}
                <Input
                  name="customCharacters"
                  value={formData.customCharacters}
                  onChange={handleInputChange}
                  placeholder="Other (e.g., Zora the Witch)"
                  className="bg-gray-800 border-gray-700 text-white mt-2"
                  disabled={isSubmitting}
                />
              </div>
            </div> */}

            {/* Tone and Difficulty */}
            <div className="space-y-2">
              <Label htmlFor="tone" className="text-white">
                Tone and Difficulty
              </Label>
              <Select
                onValueChange={(value) => handleSelectChange('tone', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choose a tone" />
                </SelectTrigger>
                <SelectContent>
                  {adventureData.tones.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Choice Style */}
            <div className="space-y-2">
              <Label className="text-white">Choice Style (Pick any)</Label>
              <div className="space-y-2">
                {adventureData.choiceStyles.map((choice) => (
                  <div key={choice} className="flex items-center space-x-2">
                    <Checkbox
                      id={choice}
                      checked={formData.choices.includes(choice)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange(
                          'choices',
                          choice,
                          checked as boolean
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={choice} className="text-gray-300">
                      {choice}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Endings */}
            <div className="space-y-2">
              <Label className="text-white">Endings (Pick any)</Label>
              <div className="space-y-2">
                {adventureData.endings.map((ending) => (
                  <div key={ending} className="flex items-center space-x-2">
                    <Checkbox
                      id={ending}
                      checked={formData.endings.includes(ending)}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange(
                          'endings',
                          ending,
                          checked as boolean
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={ending} className="text-gray-300">
                      {ending}
                    </Label>
                  </div>
                ))}
                <Input
                  name="customEndings"
                  value={formData.customEndings}
                  onChange={handleInputChange}
                  placeholder="Other (e.g., Eternal Peace)"
                  className="bg-gray-800 border-gray-700 text-white mt-2"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Adventure'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}