import { MapPin, Home, Layers, Play, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const steps = [
  {
    icon: MapPin,
    title: '1. Choose location',
    body: 'Pick a spot in Ladakh — the simulator uses its real weather data for the day you choose.',
  },
  {
    icon: Home,
    title: '2. Describe shelter',
    body: 'Set the shape: length, width and height. No architecture degree required.',
  },
  {
    icon: Layers,
    title: '3. Pick materials',
    body: 'Choose what the walls, roof and windows are made of — each has a different insulation value.',
  },
  {
    icon: Play,
    title: '4. Run & read results',
    body: 'The server predicts a full day indoors — temperature, sunlight captured and heat flow.',
  },
];

export function HowToUseSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          How to use
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>How ShelterSim works</SheetTitle>
          <SheetDescription>Four steps from a blank map to a thermal forecast.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-4">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <div className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm leading-none font-medium">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </div>
          ))}

          <div className="border-t pt-4">
            <p className="text-sm font-medium">What the results mean</p>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-sm">
              <li>
                <span className="text-foreground">Indoor temperature curve</span> — how warm it
                stays inside over the day, next to the outdoor temperature.
              </li>
              <li>
                <span className="text-foreground">Solar energy captured</span> — sunlight entering
                through windows and warming the walls.
              </li>
              <li>
                <span className="text-foreground">Heat flow</span> — where warmth is gained and
                lost: sun, walls, windows, ground, draughts.
              </li>
            </ul>
          </div>

          <div className="bg-accent/50 flex gap-2 rounded-lg border p-3">
            <Lightbulb className="text-accent-foreground size-4 shrink-0" />
            <p className="text-sm">
              <span className="font-medium">Tip: </span>
              The night-time minimum at 06:00 is the number that matters most in Ladakh — that's the
              coldest moment a shelter has to survive.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
